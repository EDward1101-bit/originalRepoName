from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings

from api import health_router, users_router
from api.auth import router as auth_router


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    prosody_url: str = "http://prosody:5280"
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

app = FastAPI(
    title="XMPP Chat API",
    description="Backend API for XMPP Chat Application",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)
