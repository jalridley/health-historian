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


settings = Settings()
