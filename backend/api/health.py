from typing import Any

from fastapi import APIRouter

from models.user import HealthResponse
from services.user_sync import user_sync

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    status = await user_sync.health_check()
    return HealthResponse(
        status="healthy" if status["prosody"] else "degraded",
        prosody=status["prosody"],
    )


@router.get("/")
async def root() -> dict[str, str]:
    return {"message": "XMPP Chat API", "status": "running"}


@router.get("/health/prosody")
async def prosody_health() -> dict[str, Any]:
    from services.prosody import prosody_client

    healthy = await prosody_client.health_check()
    return {"prosody": healthy, "status": "healthy" if healthy else "unhealthy"}
