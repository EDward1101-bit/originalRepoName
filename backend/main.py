from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import bots_router, health_router, users_router
from api.auth import router as auth_router
from config import settings


app = FastAPI(
    title="XMPP Chat API",
    description="Backend API for XMPP Chat Application",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(bots_router)
