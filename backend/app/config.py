from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Remote Dementia Monitoring API"
    app_version: str = "0.1.0"

    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/dementia_monitoring"
    )

    auth0_domain: str = "your-tenant.auth0.com"
    auth0_audience: str = "https://dementia-monitoring-api"
    auth0_algorithm: str = "RS256"
    auth0_roles_claim: str = "https://dementia-monitoring-api/roles"

    elevenlabs_api_key: str = ""
    gemini_api_key: str = ""
    presage_api_key: str = ""
    presage_api_url: str = "https://api.presage.example.com/v1/behavioral-risk"
    presage_timeout_seconds: float = 10.0


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
