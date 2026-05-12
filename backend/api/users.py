import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from models.user import UserCreateRequest
from services.prosody import prosody_client
from services.user_sync import UserCreate, user_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/", response_model=dict[str, Any])
async def create_user(user: UserCreateRequest) -> dict[str, Any]:
    try:
        result = await user_sync.create_user(UserCreate(**user.model_dump()))
        return result
    except Exception as e:
        logger.error("Failed to create user %s: %s", user.username, e)
        raise HTTPException(status_code=400, detail="Failed to create user") from None


@router.get("/", response_model=list[dict[str, Any]])
async def list_users() -> list[dict[str, Any]]:
    try:
        users = await user_sync.get_prosody_users()
        return users
    except Exception as e:
        logger.error("Failed to list users: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error") from None


@router.get("/{username}", response_model=dict[str, Any])
async def get_user(username: str) -> dict[str, Any]:
    user = await prosody_client.get_user(username)
    if user:
        return user
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/{username}")
async def delete_user(username: str) -> dict[str, Any]:
    success = await user_sync.delete_user(username)
    if success:
        return {"deleted": True, "username": username}
    raise HTTPException(status_code=404, detail="User not found")
