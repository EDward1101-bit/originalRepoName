from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    prosody_url: str = "http://prosody:5280"
    environment: str = "development"
    server_hostname: str = Field(alias="SERVER_HOSTNAME")

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()
