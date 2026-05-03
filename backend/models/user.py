from pydantic import BaseModel


class UserCreateRequest(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    full_name: str | None = None


class HealthResponse(BaseModel):
    status: str
    prosody: bool
