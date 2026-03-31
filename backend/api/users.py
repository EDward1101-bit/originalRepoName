from fastapi import APIRouter, HTTPException

from models.user import UserCreateRequest
from services.prosody import prosody_client
from services.user_sync import UserCreate, user_sync

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/", response_model=dict)
async def create_user(user: UserCreateRequest):
    try:
        result = await user_sync.create_user(UserCreate(**user.model_dump()))
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/", response_model=list[dict])
async def list_users():
    try:
        users = await user_sync.get_prosody_users()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.get("/{username}", response_model=dict)
async def get_user(username: str):
    user = await prosody_client.get_user(username)
    if user:
        return user
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/{username}")
async def delete_user(username: str):
    success = await user_sync.delete_user(username)
    if success:
        return {"deleted": True, "username": username}
    raise HTTPException(status_code=404, detail="User not found")
