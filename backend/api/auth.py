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
    
    logger.error("="*50)
    logger.error(f"[Auth] VERIFY REQUEST RECEIVED: {request.username}")

    # Use service client to bypass RLS for administrative lookup
    supabase = get_service_client() or get_supabase_client()
    has_service_key = get_service_client() is not None

    try:
        start_time = time.time()
        username = request.username.lower().strip()
        
        # Log password info (SAFE: only first 2 chars and length)
        pwd_len = len(request.password) if request.password else 0
        pwd_prefix = request.password[:2] if pwd_len >= 2 else "??"
        logger.error(f"[Auth] Verifying: {username} | Pwd Len: {pwd_len} | Prefix: {pwd_prefix}")
        
        if pwd_len == 0:
            logger.error(f"[Auth] FAILED: Password is empty for {username}")
            return AuthVerifyResponse(valid=False, user_id=None)
        
        user_email = None
        user_id = None

        # 1. DB Lookup by Username (Exact match preferred)
        db_start = time.time()
        user_response = (
            supabase.table("users")
            .select("id, email, username")
            .eq("username", username)
            .execute()
        )
        
        if user_response.data and len(user_response.data) > 0:
            user = user_response.data[0]
            user_id = str(user.get("id", ""))
            user_email = user.get("email", "")
            logger.info(f"[Auth] Found in DB by username: {user_email} (took {time.time() - db_start:.2f}s)")
        else:
            # 2. DB Lookup by Email Localpart (Pattern match)
            user_response = (
                supabase.table("users")
                .select("id, email, username")
                .ilike("email", f"{username}@%")
                .execute()
            )
            if user_response.data and len(user_response.data) > 0:
                user = user_response.data[0]
                user_id = str(user.get("id", ""))
                user_email = user.get("email", "")
                logger.info(f"[Auth] Found in DB by email localpart: {user_email}")

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
            logger.info(f"[Auth] Attempting sign-in for: {user_email}")
            auth_response = supabase.auth.sign_in_with_password(
                {"email": user_email, "password": request.password}
            )
            auth_end = time.time()
            logger.info(f"[Auth] Supabase sign_in response received in {auth_end - auth_start:.2f}s")

            if auth_response.user:
                logger.info(f"[Auth] SUCCESS for {user_email} (Total: {time.time() - start_time:.2f}s)")
                # Use the ID from the successful auth if we didn't find one in the DB
                final_user_id = user_id or auth_response.user.id
                return AuthVerifyResponse(valid=True, user_id=str(final_user_id))
            
            logger.warning(f"[Auth] FAILED for {user_email}: Sign-in returned no user object")
        except Exception as auth_err:
            # Catch and log specific Supabase error messages (e.g., "Email not confirmed", "Invalid login credentials")
            err_msg = str(auth_err)
            logger.error(f"[Auth] EXCEPTION during sign_in for {user_email}: {err_msg}")
            
            if "Email not confirmed" in err_msg:
                logger.error(f"[Auth] Hint: User {user_email} has not confirmed their email in Supabase.")
            elif "Invalid login credentials" in err_msg:
                logger.error(f"[Auth] Hint: The password provided for {user_email} is incorrect.")
            elif "User not found" in err_msg:
                logger.error(f"[Auth] Hint: The user {user_email} does not exist in Supabase Auth.")

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
    import traceback
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"[Sync] === Sync Request Received for: {request.username} ===")
        # Use service client to ensure we can write to public.users
        supabase = get_service_client() or get_supabase_client()
        
        # 1. Self-heal: Ensure user exists in public.users
        logger.info(f"[Sync] Checking if user {request.username} exists in DB...")
        user_response = (
            supabase.table("users")
            .select("id")
            .ilike("email", f"{request.username}@%")
            .execute()
        )

        if not user_response.data or len(user_response.data) == 0:
            logger.info(f"[Sync] User {request.username} missing from DB. Attempting self-heal.")
            # ... (rest of self-heal logic)
            # We need to find the user's ID and full email from Supabase Auth
            auth_user_data = None
            try:
                # Try to sign in to get the actual user info
                email_guess = f"{request.username}@{settings.server_hostname}"
                logger.info(f"[Sync] Self-heal: trying sign-in with {email_guess}")
                auth_resp = supabase.auth.sign_in_with_password(
                    {"email": email_guess, "password": request.password}
                )
                if auth_resp.user:
                    auth_user_data = auth_resp.user
                    logger.info(f"[Sync] Self-heal: Auth successful for {auth_user_data.email}")
            except Exception as auth_err:
                logger.warning(f"[Sync] Self-heal: Auth sign-in failed: {str(auth_err)}")
                # Fallback to admin search if sign-in fails (e.g. wrong domain guess)
                service_client = get_service_client()
                if service_client:
                    logger.info(f"[Sync] Self-heal: Searching via admin client...")
                    try:
                        admin_resp = service_client.auth.admin.list_users()
                        for u in admin_resp:
                            if u.email and u.email.lower().startswith(f"{request.username.lower()}@"):
                                auth_user_data = u
                                logger.info(f"[Sync] Self-heal: Found user via admin: {u.email}")
                                break
                    except Exception as admin_err:
                        logger.error(f"[Sync] Self-heal: Admin search failed: {str(admin_err)}")
            
            if auth_user_data:
                logger.info(f"[Sync] Self-healing user record for {auth_user_data.email}")
                try:
                    supabase.table("users").upsert({
                        "id": auth_user_data.id,
                        "email": auth_user_data.email,
                        "username": request.username,
                        "xmpp_created": True
                    }).execute()
                    logger.info(f"[Sync] Self-heal: DB record upserted.")
                except Exception as db_err:
                    logger.error(f"[Sync] Self-heal: DB upsert failed: {str(db_err)}")
                    raise Exception(f"Database self-heal failed: {str(db_err)}")
            else:
                logger.error(f"[Sync] Self-heal: Could not find user in Supabase Auth")
                raise Exception("User not found in Supabase Auth during sync")

        # 2. Sync to Prosody (which we know is just a pass-through now)
        logger.info(f"[Sync] Calling Prosody sync for {request.username}")
        await user_sync.sync_user_to_prosody(request.username, request.password)
        
        logger.info(f"[Sync] SUCCESS for {request.username}")
        return {"synced": True, "username": request.username}
    except Exception as e:
        logger.exception(f"[Sync] Exception occurred during sync/self-heal for {request.username}")
        # Include the error message in the 400 response for debugging
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
