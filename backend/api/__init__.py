try:
	from api.health import router as health_router
	from api.users import router as users_router
except ModuleNotFoundError:  # Allow running from repo root
	from backend.api.health import router as health_router
	from backend.api.users import router as users_router

__all__ = ["users_router", "health_router"]
