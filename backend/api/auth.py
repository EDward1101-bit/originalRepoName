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
    from services.supabase import get_supabase_client, get_service_client
    from config import settings
    import logging
    import time
    logger = logging.getLogger(__name__)

    # Use service client to bypass RLS for administrative lookup
    supabase = get_service_client() or get_supabase_client()
    has_service_key = get_service_client() is not None

    try:
        start_time = time.time()
        username = request.username.lower().strip()
        logger.info(f"[Auth] Verifying: {username}")
        
        user_email = None
        user_id = None

        # 1. DB Lookup by Email Localpart
        db_start = time.time()
        user_response = (
            supabase.table("users")
            .select("id, email")
            .ilike("email", f"{username}@%")
            .execute()
        )
        db_end = time.time()
        
        if user_response.data and len(user_response.data) > 0:
            user = user_response.data[0]
            user_id = str(user.get("id", ""))
            user_email = user.get("email", "")
            logger.info(f"[Auth] Found in DB by email: {user_email} (took {db_end - db_start:.2f}s)")
        else:
            # 2. DB Lookup by Username
            logger.warning(f"[Auth] Not found in DB by email: {username}. Trying username fallback.")
            user_response = (
                supabase.table("users")
                .select("id, email")
                .ilike("username", username)
                .execute()
            )
            if user_response.data and len(user_response.data) > 0:
                user = user_response.data[0]
                user_id = str(user.get("id", ""))
                user_email = user.get("email", "")
                logger.info(f"[Auth] Found in DB by username: {user_email}")

        # 3. (135 IQ Fallback) Supabase Auth Admin Search
        # If DB lookup failed but we have a service key, we can search all auth users.
        if not user_email and has_service_key:
            logger.info(f"[Auth] DB lookup failed for {username}. Searching Supabase Auth Admin...")
            try:
                # We can't filter list_users by email localpart server-side, 
                # but we can list and find the match.
                admin_users_resp = supabase.auth.admin.list_users()
                for u in admin_users_resp:
                    if u.email and u.email.lower().startswith(f"{username}@"):
                        user_email = u.email
                        user_id = u.id
                        logger.info(f"[Auth] Found in Supabase Auth Admin: {user_email}")
                        break
            except Exception as admin_err:
                logger.error(f"[Auth] Admin list_users failed: {str(admin_err)}")

        # 4. Final Fallback: Guess the email if still not found
        if not user_email:
            user_email = f"{username}@{settings.server_hostname}"
            logger.info(f"[Auth] User totally unknown. Guessing email: {user_email}")

        # 5. Supabase Auth Call (The ultimate proof of password)
        auth_start = time.time()
        try:
            auth_response = supabase.auth.sign_in_with_password(
                {"email": user_email, "password": request.password}
            )
            auth_end = time.time()
            logger.info(f"[Auth] Supabase sign_in took {auth_end - auth_start:.2f}s")

            if auth_response.user:
                logger.info(f"[Auth] SUCCESS for {user_email} (Total: {time.time() - start_time:.2f}s)")
                # Use the ID from the successful auth if we didn't find one in the DB
                final_user_id = user_id or auth_response.user.id
                return AuthVerifyResponse(valid=True, user_id=str(final_user_id))
            
            logger.warning(f"[Auth] FAILED for {user_email}: Invalid credentials")
        except Exception as auth_err:
            logger.error(f"[Auth] EXCEPTION during sign_in for {user_email}: {str(auth_err)}")

        return AuthVerifyResponse(valid=False, user_id=None)

    except Exception as e:
        logger.error(f"[Auth] UNEXPECTED error: {str(e)}")
        return AuthVerifyResponse(valid=False, user_id=None)


@router.post("/sync-user")
async def sync_user_to_prosody(request: SyncUserRequest) -> dict[str, Any]:
    """Sync a Supabase-authenticated user to Prosody XMPP server and ensure DB consistency"""
    from services.user_sync import user_sync
    from services.supabase import get_service_client, get_supabase_client
    import logging
    logger = logging.getLogger(__name__)

    # Use service client to ensure we can write to public.users
    supabase = get_service_client() or get_supabase_client()

    try:
        # 1. Self-heal: Ensure user exists in public.users
        # We look up by email localpart
        user_response = (
            supabase.table("users")
            .select("id")
            .ilike("email", f"{request.username}@%")
            .execute()
        )

        if not user_response.data or len(user_response.data) == 0:
            logger.info(f"[Sync] User {request.username} missing from DB. Attempting self-heal.")
            # We need to find the user's ID and full email from Supabase Auth
            auth_user_data = None
            try:
                # Try to sign in to get the actual user info
                auth_resp = supabase.auth.sign_in_with_password(
                    {"email": f"{request.username}@{settings.server_hostname}", "password": request.password}
                )
                if auth_resp.user:
                    auth_user_data = auth_resp.user
            except Exception:
                # Fallback to admin search if sign-in fails (e.g. wrong domain guess)
                if get_service_client():
                    admin_resp = supabase.auth.admin.list_users()
                    for u in admin_resp:
                        if u.email and u.email.lower().startswith(f"{request.username}@"):
                            auth_user_data = u
                            break
            
            if auth_user_data:
                logger.info(f"[Sync] Self-healing user record for {auth_user_data.email}")
                supabase.table("users").upsert({
                    "id": auth_user_data.id,
                    "email": auth_user_data.email,
                    "username": request.username,
                    "xmpp_created": True
                }).execute()

        # 2. Sync to Prosody (which we know is just a pass-through now)
        await user_sync.sync_user_to_prosody(request.username, request.password)
        
        return {"synced": True, "username": request.username}
    except Exception as e:
        logger.error(f"[Sync] Error during sync/self-heal: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/users/{username}", response_model=dict[str, Any])
async def check_user_exists(username: str) -> dict[str, Any]:
    from services.supabase import get_supabase_client, get_service_client

    # Use service client to bypass RLS
    supabase = get_service_client() or get_supabase_client()

    try:
        sanitized_username = username.lower().strip()
        # Look up by email localpart (XMPP username)
        response = (
            supabase.table("users")
            .select("id, username, email")
            .ilike("email", f"{sanitized_username}@%")
            .execute()
        )

        if not response.data or len(response.data) == 0:
            # Fallback to username
            response = (
                supabase.table("users")
                .select("id, username, email")
                .ilike("username", sanitized_username)
                .execute()
            )

        if response.data and len(response.data) > 0:
            return {"exists": True, "user": response.data[0]}

        return {"exists": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from None
