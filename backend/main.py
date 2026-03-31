from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
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


@app.get("/")
async def root():
    return {"message": "XMPP Chat API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
