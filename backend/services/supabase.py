
from pydantic_settings import BaseSettings
from supabase import Client, create_client


class SupabaseSettings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str | None = None

    class Config:
        env_file = ".env"
        extra = "allow"


settings = SupabaseSettings()


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_service_client() -> Client | None:
    if settings.supabase_service_key:
        return create_client(settings.supabase_url, settings.supabase_service_key)
    return None
