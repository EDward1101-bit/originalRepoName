import logging

from pydantic import BaseModel

from services.prosody import prosody_client
from services.supabase import get_supabase_client

logger = logging.getLogger(__name__)


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None


class UserSync:
    @staticmethod
    async def create_user(user: UserCreate) -> dict:
        supabase = get_supabase_client()

        prosody_response = await prosody_client.create_user(user.username, user.password)

        auth_data = {
            "email": user.email or f"{user.username}@localhost",
            "password": user.password,
        }

        auth_response = supabase.auth.admin.create_user(auth_data)

        if auth_response.user:
            user_data = {
                "id": auth_response.user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
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
        supabase = get_supabase_client()

        await prosody_client.delete_user(username)

        supabase.table("users").delete().eq("username", username).execute()

        return True

    @staticmethod
    async def sync_user_to_prosody(username: str, password: str) -> bool:
        existing = await prosody_client.get_user(username)
        if existing:
            return True

        await prosody_client.create_user(username, password)
        return True

    @staticmethod
    async def get_prosody_users() -> list[dict]:
        return await prosody_client.get_users()

    @staticmethod
    async def health_check() -> dict:
        prosody_healthy = await prosody_client.health_check()
        return {"prosody": prosody_healthy}


user_sync = UserSync()
