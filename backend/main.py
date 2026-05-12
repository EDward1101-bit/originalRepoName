from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

from api import bots_router, health_router, users_router
from api.auth import router as auth_router


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    prosody_url: str = "http://prosody:5280"
    environment: str = "development"
    # Comma-separated list of allowed frontend origins.
    # Override in production: ALLOWED_ORIGINS=https://yourdomain.com
    allowed_origins: str = "http://localhost:5173,http://localhost:4173"

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()

allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app = FastAPI(
    title="XMPP Chat API",
    description="Backend API for XMPP Chat Application",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Aether-Secret", "X-Aether-Signature"],
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(bots_router)
