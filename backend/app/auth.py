import os
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

security = HTTPBearer(auto_error=False)

_jwk_client: PyJWKClient | None = None


@dataclass(frozen=True)
class CurrentUser:
    sub: str
    email: str | None


def _jwks_url() -> str:
    url = os.environ.get("SUPABASE_JWKS_URL")
    if not url:
        raise RuntimeError(
            "SUPABASE_JWKS_URL is not set. Example: "
            "https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"
        )
    return url


def _issuer() -> str:
    issuer = os.environ.get("SUPABASE_JWT_ISSUER")
    if not issuer:
        raise RuntimeError(
            "SUPABASE_JWT_ISSUER is not set. Example: "
            "https://<project-ref>.supabase.co/auth/v1"
        )
    return issuer.rstrip("/")


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_jwks_url())
    return _jwk_client


def _decode_supabase_access_token(token: str) -> CurrentUser:
    try:
        client = _get_jwk_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=_issuer(),
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except PyJWKClientConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach signing key service.",
        ) from exc
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify token.",
        ) from exc

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims.",
        )

    email = payload.get("email")
    if email is not None and not isinstance(email, str):
        email = None

    return CurrentUser(sub=sub, email=email)


def reset_jwk_client_cache() -> None:
    global _jwk_client
    _jwk_client = None


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(security),
    ],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    return _decode_supabase_access_token(credentials.credentials)
