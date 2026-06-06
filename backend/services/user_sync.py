import logging
from typing import Any

from pydantic import BaseModel

from services.prosody import prosody_client
from services.supabase import get_supabase_client

from config import settings

logger = logging.getLogger(__name__)


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None


class UserSync:
    @staticmethod
    async def create_user(user: UserCreate) -> dict[str, Any]:
        from services.supabase import get_service_client, get_supabase_client
        supabase = get_service_client() or get_supabase_client()

        # prosody_client.create_user is removed to avoid deadlocks. 
        # Prosody will see the user as soon as they are in the DB.
        prosody_response = {"status": "dynamic_auth_enabled"}

        auth_email = user.email or f"{user.username}@{settings.server_hostname}"
        auth_data: dict[str, str] = {
            "email": auth_email,
            "password": user.password,
        }

        auth_response = supabase.auth.admin.create_user(auth_data)  # type: ignore[arg-type]

        if auth_response.user:
            user_data = {
                "id": auth_response.user.id,
                "username": user.username,
                "email": auth_email, # Store the actual email used
                "xmpp_created": True,
            }

            supabase.table("users").insert(user_data).execute()

            return {
                "user": user_data,
                "prosody": prosody_response,
                "auth": {"id": auth_response.user.id},
            }

        raise Exception("Failed to create user in Supabase Auth")

    @staticmethod
    async def delete_user(username: str) -> bool:
        from services.supabase import get_service_client, get_supabase_client
        supabase = get_service_client() or get_supabase_client()

        # prosody_client.delete_user(username) is removed. 
        # Deleting from the DB effectively removes them from Prosody.

        supabase.table("users").delete().eq("username", username).execute()

        return True

    @staticmethod
    async def sync_user_to_prosody(username: str, password: str) -> bool:
        # We no longer call Prosody here. 
        # The backend's /sync-user endpoint already ensures the DB record exists.
        # Prosody will authenticate against that DB record dynamically.
        return True

    @staticmethod
    async def get_prosody_users() -> list[dict[str, Any]]:
        return await prosody_client.get_users()

    @staticmethod
    async def health_check() -> dict[str, Any]:
        prosody_healthy = await prosody_client.health_check()
        return {"prosody": prosody_healthy}


user_sync = UserSync()
