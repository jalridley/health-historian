from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    DATABASE_URL: str

    FRONTEND_ORIGIN: str = "http://localhost:3000"

    SUPABASE_JWKS_URL: str
    SUPABASE_JWT_ISSUER: str

    GCP_PROJECT_ID: str
    GCS_BUCKET_NAME: str
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None


settings = Settings()
