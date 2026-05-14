import os

import pytest

from app import auth


@pytest.fixture(autouse=True)
def auth_env_and_reset_jwks_cache() -> None:
    os.environ.setdefault(
        "SUPABASE_JWKS_URL",
        "https://127.0.0.1:9/jwks.json",
    )
    os.environ.setdefault(
        "SUPABASE_JWT_ISSUER",
        "https://example.invalid/auth/v1",
    )
    auth.reset_jwk_client_cache()
    yield
    auth.reset_jwk_client_cache()
