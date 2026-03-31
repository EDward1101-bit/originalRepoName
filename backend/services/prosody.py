
import httpx
from pydantic_settings import BaseSettings


class ProsodySettings(BaseSettings):
    prosody_url: str = "http://prosody:5280"
    prosody_admin_user: str = "admin"
    prosody_admin_password: str | None = None

    class Config:
        env_file = ".env"
        extra = "allow"


settings = ProsodySettings()


class ProsodyClient:
    def __init__(self, base_url: str = settings.prosody_url):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def health_check(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/health")
            return response.status_code == 200
        except httpx.RequestError:
            return False

    async def get_users(self) -> list[dict]:
        response = await self.client.get(f"{self.base_url}/users")
        response.raise_for_status()
        data = response.json()
        return data.get("users", [])

    async def get_user(self, username: str) -> dict | None:
        try:
            response = await self.client.get(f"{self.base_url}/users/{username}")
            if response.status_code == 200:
                return response.json()
            return None
        except httpx.HTTPError:
            return None

    async def create_user(self, username: str, password: str) -> dict:
        response = await self.client.post(
            f"{self.base_url}/users/{username}",
            json={"password": password},
        )
        response.raise_for_status()
        return response.json()

    async def delete_user(self, username: str) -> bool:
        response = await self.client.delete(f"{self.base_url}/users/{username}")
        return response.status_code == 200

    async def check_auth(self, username: str) -> bool:
        try:
            response = await self.client.post(
                f"{self.base_url}/auth",
                json={"username": username, "host": "localhost"},
            )
            if response.status_code == 200:
                return response.json().get("exists", False)
            return False
        except httpx.HTTPError:
            return False

    async def close(self):
        await self.client.aclose()


prosody_client = ProsodyClient()
