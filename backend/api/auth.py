from typing import Any, cast

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthVerifyRequest(BaseModel):
    username: str
    password: str
    host: str = settings.server_hostname


class AuthVerifyResponse(BaseModel):
    valid: bool
    user_id: str | None = None


class SyncUserRequest(BaseModel):
    username: str
    password: str


@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_credentials(request: AuthVerifyRequest) -> AuthVerifyResponse:
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()

    try:
        # Search for user by email localpart (their XMPP username)
        user_response = (
            supabase.table("users")
            .select("id, username, email")
            .ilike("email", f"{request.username}@%")
            .execute()
        )

        if not user_response.data or len(user_response.data) == 0:
            # Fallback: try looking up by username directly
            user_response = (
                supabase.table("users")
                .select("id, username, email")
                .eq("username", request.username)
                .execute()
            )

        if not user_response.data or len(user_response.data) == 0:
            return AuthVerifyResponse(valid=False, user_id=None)

        user = user_response.data[0]
        user_id = str(user.get("id", ""))
        user_email = user.get("email", "")

        if not user_email:
            return AuthVerifyResponse(valid=False, user_id=None)

        # Use the actual email from the database for Supabase Auth
        auth_response = supabase.auth.sign_in_with_password(
            {"email": user_email, "password": request.password}
        )

        if auth_response.user:
            return AuthVerifyResponse(valid=True, user_id=user_id)

        return AuthVerifyResponse(valid=False, user_id=None)

    except Exception:
        return AuthVerifyResponse(valid=False, user_id=None)


@router.post("/sync-user")
async def sync_user_to_prosody(request: SyncUserRequest) -> dict[str, Any]:
    """Sync a Supabase-authenticated user to Prosody XMPP server"""
    from services.user_sync import user_sync

    try:
        await user_sync.sync_user_to_prosody(request.username, request.password)
        return {"synced": True, "username": request.username}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/users/{username}", response_model=dict[str, Any])
async def check_user_exists(username: str) -> dict[str, Any]:
    from services.supabase import get_supabase_client

    supabase = get_supabase_client()

    try:
        # Look up by email localpart (XMPP username)
        response = (
            supabase.table("users")
            .select("id, username, email")
            .ilike("email", f"{username}@%")
            .execute()
        )

        if not response.data or len(response.data) == 0:
            # Fallback to username
            response = (
                supabase.table("users")
                .select("id, username, email")
                .eq("username", username)
                .execute()
            )

        if response.data and len(response.data) > 0:
            return {"exists": True, "user": response.data[0]}

        return {"exists": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from None
