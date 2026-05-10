import hashlib
import hmac
import json
import re
import secrets
import time
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/bots", tags=["bots"])

# ── Built-in inline filters ───────────────────────────────────────────────────
_SWEAR_PATTERN = re.compile(
    r"\b(shit|fuck|crap|ass|damn|bitch|bastard|piss|cock|cunt|dick|prick|twat|wanker|bollocks)\b",
    re.IGNORECASE,
)

BUILTIN_FILTERS: dict[str, Any] = {
    "swear-filter-bot": lambda body: _SWEAR_PATTERN.sub("***", body),
}


# ── Helpers ──────────────────────────────────────────────────────────────────
def _sign_payload(secret: str, payload: dict) -> str:
    msg = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    digest = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# In-memory store for bot heartbeats: bot_id -> timestamp
bot_heartbeats: dict[str, float] = {}


# ── Request / Response models ─────────────────────────────────────────────────
class RegisterBotRequest(BaseModel):
    name: str
    description: str = ""
    emoji: str = "🤖"
    webhook_url: str
    owner_username: str


class RegisterBotResponse(BaseModel):
    bot_id: str
    webhook_secret: str


class DispatchRequest(BaseModel):
    message_id: str
    room_name: str
    body: str
    sender: str


class EditMessageRequest(BaseModel):
    body: str


class SendMessageRequest(BaseModel):
    body: str


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[dict])
async def list_bots() -> list[dict]:
    from services.supabase import get_supabase_client
    supabase = get_supabase_client()
    response = (
        supabase.table("bots")
        .select("id, name, description, emoji, webhook_url, owner_username, is_builtin, is_active, created_at")
        .eq("is_active", True)
        .execute()
    )
    bots = response.data or []
    current_time = time.time()
    for bot in bots:
        if bot.get("is_builtin"):
            bot["is_online"] = True
        else:
            bot["is_online"] = (current_time - bot_heartbeats.get(bot["id"], 0)) <= 60.0
    return bots


@router.post("/register", response_model=RegisterBotResponse)
async def register_bot(req: RegisterBotRequest) -> RegisterBotResponse:
    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    bot_id = secrets.token_hex(8)
    webhook_secret = secrets.token_hex(32)

    response = (
        supabase.table("bots")
        .insert({
            "id": bot_id,
            "name": req.name,
            "description": req.description,
            "emoji": req.emoji,
            "webhook_url": req.webhook_url,
            "webhook_secret": webhook_secret,
            "owner_username": req.owner_username,
            "is_builtin": False,
            "is_active": True,
        })
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to register bot")
    return RegisterBotResponse(bot_id=bot_id, webhook_secret=webhook_secret)


@router.delete("/{bot_id}")
async def delete_bot(bot_id: str, owner_username: str) -> dict[str, Any]:
    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    check = supabase.table("bots").select("owner_username, is_builtin").eq("id", bot_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    row = check.data[0]
    if row.get("is_builtin"):
        raise HTTPException(status_code=403, detail="Cannot delete a built-in bot")
    if row.get("owner_username") != owner_username:
        raise HTTPException(status_code=403, detail="Not your bot")

    supabase.table("bots").update({"is_active": False}).eq("id", bot_id).execute()
    return {"deleted": True}


@router.post("/heartbeat")
async def bot_heartbeat(x_aether_secret: str = Header(None)) -> dict[str, str]:
    """Bot SDK endpoint to maintain online status."""
    if not x_aether_secret:
        raise HTTPException(status_code=401, detail="Missing X-Aether-Secret header")

    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    bots_resp = supabase.table("bots").select("id").eq("webhook_secret", x_aether_secret).eq("is_active", True).execute()
    if not bots_resp.data:
        raise HTTPException(status_code=401, detail="Invalid bot secret")

    bot_id = bots_resp.data[0]["id"]
    bot_heartbeats[bot_id] = time.time()

    return {"status": "ok"}


async def process_dispatch(req: DispatchRequest):
    """Background task to notify bots and handle built-ins async."""
    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    room_resp = supabase.table("rooms").select("id").eq("name", req.room_name).execute()
    if not room_resp.data:
        return
    room_id = room_resp.data[0]["id"]

    room_bots_resp = supabase.table("room_bots").select("bot_id").eq("room_id", room_id).execute()
    if not room_bots_resp.data:
        return
    bot_ids = [row["bot_id"] for row in room_bots_resp.data]

    bots_resp = (
        supabase.table("bots")
        .select("id, webhook_url, webhook_secret, is_builtin")
        .in_("id", bot_ids)
        .eq("is_active", True)
        .execute()
    )
    all_bots = bots_resp.data or []
    if not all_bots:
        return

    # Filter out offline custom bots
    current_time = time.time()
    bots = []
    for bot in all_bots:
        if bot.get("is_builtin"):
            bots.append(bot)
        else:
            if (current_time - bot_heartbeats.get(bot["id"], 0)) <= 60.0:
                bots.append(bot)

    if not bots:
        return

    # Payload matching the SDK model
    payload = {
        "event": "message_create",
        "message": {
            "id": req.message_id,
            "room_name": req.room_name,
            "sender": req.sender,
            "body": req.body,
            "timestamp": int(time.time()),
        }
    }

    async with httpx.AsyncClient(timeout=2.0) as client:
        for bot in bots:
            if bot.get("is_builtin"):
                # Run built-in filter and edit immediately if changed
                inline = BUILTIN_FILTERS.get(bot["id"])
                if inline:
                    filtered = inline(req.body)
                    if filtered != req.body:
                        # Update database directly
                        supabase.table("room_messages").update({"body": filtered}).eq("id", req.message_id).execute()
            elif bot.get("webhook_url"):
                secret = bot.get("webhook_secret") or ""
                signature = _sign_payload(secret, payload)
                try:
                    await client.post(
                        bot["webhook_url"],
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Aether-Signature": signature,
                        },
                    )
                except (httpx.TimeoutException, httpx.RequestError):
                    pass


@router.post("/dispatch")
async def dispatch(req: DispatchRequest, background_tasks: BackgroundTasks) -> dict[str, str]:
    """Trigger the async webhook dispatch. Returns immediately."""
    background_tasks.add_task(process_dispatch, req)
    return {"status": "ok"}


# ── Bot SDK REST API ──────────────────────────────────────────────────────────
@router.patch("/messages/{message_id}")
async def edit_bot_message(message_id: str, req: EditMessageRequest, x_aether_secret: str = Header(None)) -> dict[str, str]:
    """Bot SDK endpoint to edit a message asynchronously."""
    if not x_aether_secret:
        raise HTTPException(status_code=401, detail="Missing X-Aether-Secret header")

    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    # Authenticate bot
    bots_resp = supabase.table("bots").select("id").eq("webhook_secret", x_aether_secret).eq("is_active", True).execute()
    if not bots_resp.data:
        raise HTTPException(status_code=401, detail="Invalid bot secret")

    # Update message body
    # (In a production system, we'd also verify the bot is in the room where the message belongs)
    res = supabase.table("room_messages").update({"body": req.body}).eq("id", message_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Message not found")

    return {"status": "edited"}


@router.delete("/messages/{message_id}")
async def delete_bot_message(message_id: str, x_aether_secret: str = Header(None)) -> dict[str, str]:
    """Bot SDK endpoint to delete a message asynchronously."""
    if not x_aether_secret:
        raise HTTPException(status_code=401, detail="Missing X-Aether-Secret header")

    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    bots_resp = supabase.table("bots").select("id").eq("webhook_secret", x_aether_secret).eq("is_active", True).execute()
    if not bots_resp.data:
        raise HTTPException(status_code=401, detail="Invalid bot secret")

    res = supabase.table("room_messages").delete().eq("id", message_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Message not found")

    return {"status": "deleted"}


@router.post("/rooms/{room_name}/messages")
async def send_bot_message(room_name: str, req: SendMessageRequest, x_aether_secret: str = Header(None)) -> dict[str, str]:
    """Bot SDK endpoint to proactively send a message to a room."""
    if not x_aether_secret:
        raise HTTPException(status_code=401, detail="Missing X-Aether-Secret header")

    from services.supabase import get_supabase_client
    supabase = get_supabase_client()

    bots_resp = supabase.table("bots").select("id, name").eq("webhook_secret", x_aether_secret).eq("is_active", True).execute()
    if not bots_resp.data:
        raise HTTPException(status_code=401, detail="Invalid bot secret")
    bot = bots_resp.data[0]

    room_resp = supabase.table("rooms").select("id").eq("name", room_name).execute()
    if not room_resp.data:
        raise HTTPException(status_code=404, detail="Room not found")
    room_id = room_resp.data[0]["id"]

    msg_id = str(uuid.uuid4())
    res = supabase.table("room_messages").insert({
        "id": msg_id,
        "room_id": room_id,
        "sender": bot["name"],
        "body": req.body
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    return {"status": "sent", "id": msg_id}
