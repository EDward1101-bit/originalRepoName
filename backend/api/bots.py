import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/bots", tags=["bots"])

# ── Built-in inline filters (no webhook needed) ─────────────────────────────
_SWEAR_PATTERN = re.compile(
    r"\b(shit|fuck|crap|ass|damn|bitch|bastard|piss|cock|cunt|dick|prick|twat|wanker|bollocks)\b",
    re.IGNORECASE,
)

BUILTIN_FILTERS: dict[str, Any] = {
    "swear-filter-bot": lambda body: _SWEAR_PATTERN.sub("***", body),
}


# ── Helpers ──────────────────────────────────────────────────────────────────
def _sign_payload(secret: str, payload: dict) -> str:
    """HMAC-SHA256 sign a payload dict using the bot's webhook_secret."""
    msg = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    digest = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# ── Request / Response models ─────────────────────────────────────────────────
class RegisterBotRequest(BaseModel):
    name: str
    description: str = ""
    emoji: str = "🤖"
    webhook_url: str
    owner_username: str


class RegisterBotResponse(BaseModel):
    bot_id: str
    webhook_secret: str  # shown ONCE — store it, it won't be shown again


class DispatchRequest(BaseModel):
    room_name: str
    body: str
    sender: str


class DispatchResponse(BaseModel):
    body: str


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[dict])
async def list_bots() -> list[dict]:
    """Return all active registered bots (built-in + external)."""
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()
    response = (
        supabase.table("bots")
        .select("id, name, description, emoji, webhook_url, owner_username, is_builtin, is_active, created_at")
        .eq("is_active", True)
        .execute()
    )
    return response.data or []


@router.post("/register", response_model=RegisterBotResponse)
async def register_bot(req: RegisterBotRequest) -> RegisterBotResponse:
    """Register an external bot. Returns a webhook_secret shown only once."""
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()

    bot_id = secrets.token_hex(8)
    webhook_secret = secrets.token_hex(32)  # stored plaintext — used to sign dispatches

    response = (
        supabase.table("bots")
        .insert(
            {
                "id": bot_id,
                "name": req.name,
                "description": req.description,
                "emoji": req.emoji,
                "webhook_url": req.webhook_url,
                "webhook_secret": webhook_secret,
                "owner_username": req.owner_username,
                "is_builtin": False,
                "is_active": True,
            }
        )
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to register bot")

    return RegisterBotResponse(bot_id=bot_id, webhook_secret=webhook_secret)


@router.delete("/{bot_id}")
async def delete_bot(bot_id: str, owner_username: str) -> dict[str, Any]:
    """Soft-delete a bot (set is_active=false). Only the owner can do this."""
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()

    check = (
        supabase.table("bots")
        .select("owner_username, is_builtin")
        .eq("id", bot_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    row = check.data[0]
    if row.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Cannot delete a built-in bot")
    if row.get("owner_username") != owner_username:
        raise HTTPException(status_code=403, detail="Not your bot")

    supabase.table("bots").update({"is_active": False}).eq("id", bot_id).execute()
    return {"deleted": True}


@router.post("/dispatch", response_model=DispatchResponse)
async def dispatch(req: DispatchRequest) -> DispatchResponse:
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()

    # Resolve room name → room_id
    room_resp = (
        supabase.table("rooms").select("id").eq("name", req.room_name).execute()
    )
    if not room_resp.data:
        return DispatchResponse(body=req.body)

    room_id = room_resp.data[0]["id"]

    # Get active bot IDs for this room
    room_bots_resp = (
        supabase.table("room_bots").select("bot_id").eq("room_id", room_id).execute()
    )
    if not room_bots_resp.data:
        return DispatchResponse(body=req.body)

    bot_ids = [row["bot_id"] for row in room_bots_resp.data]

    # Fetch full bot records
    bots_resp = (
        supabase.table("bots")
        .select("id, webhook_url, webhook_secret, is_builtin")
        .in_("id", bot_ids)
        .eq("is_active", True)
        .execute()
    )
    bots = bots_resp.data or []
    if not bots:
        return DispatchResponse(body=req.body)

    current_body = req.body

    async with httpx.AsyncClient(timeout=2.0) as client:
        for bot in bots:
            bot_id: str = bot["id"]

            if bot.get("is_builtin") or not bot.get("webhook_url"):
                # ── Inline built-in filter ──
                inline = BUILTIN_FILTERS.get(bot_id)
                if inline:
                    current_body = inline(current_body)
            else:
                # ── External webhook ──
                payload = {
                    "body": current_body,
                    "room_name": req.room_name,
                    "sender": req.sender,
                    "timestamp": int(time.time()),
                }
                secret: str = bot.get("webhook_secret") or ""
                signature = _sign_payload(secret, payload)

                try:
                    resp = await client.post(
                        bot["webhook_url"],
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Aether-Signature": signature,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        filtered = data.get("body")
                        if isinstance(filtered, str):
                            current_body = filtered
                except (httpx.TimeoutException, httpx.RequestError):
                    # Bot unavailable — silently pass through
                    pass

    return DispatchResponse(body=current_body)
