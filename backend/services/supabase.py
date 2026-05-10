from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client


class SupabaseSettings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str | None = None
    test_mode: bool = Field(default=False, validation_alias="PYTEST_TESTING")

    @model_validator(mode="after")
    def apply_test_mode_overrides(self) -> "SupabaseSettings":
        if self.test_mode:
            self.supabase_url = ""
            self.supabase_anon_key = ""
            self.supabase_service_key = None
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = SupabaseSettings()


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache(maxsize=1)
def get_service_client() -> Client | None:
    if settings.supabase_service_key:
        return create_client(settings.supabase_url, settings.supabase_service_key)
    return None
