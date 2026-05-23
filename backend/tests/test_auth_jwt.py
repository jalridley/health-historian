"""Milestone 2 auth checkpoint: JWT verification and protected-route access."""

import uuid
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError

from app.auth import CurrentUser, _decode_supabase_access_token, get_current_user
from app.db.session import get_session
from app.main import app
from app.models.profile import Profile
from app.models.user import User
from tests.conftest import TEST_AUTH_USER_ID

FAKE_BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"
TEST_ISSUER = "https://example.invalid/auth/v1"


def _valid_payload() -> dict[str, Any]:
    return {
        "sub": str(TEST_AUTH_USER_ID),
        "email": "test@example.com",
        "iss": TEST_ISSUER,
        "aud": "authenticated",
        "exp": 4_102_444_800,
    }


@contextmanager
def _patch_jwt_verification(
    *,
    decode_return: dict[str, Any] | None = None,
    decode_side_effect: BaseException | None = None,
) -> Generator[None, None, None]:
    signing_key = MagicMock(key="test-signing-key")
    jwk_client = MagicMock()
    jwk_client.get_signing_key_from_jwt.return_value = signing_key

    with patch("app.auth._get_jwk_client", return_value=jwk_client):
        with patch(
            "app.auth.jwt.decode",
            return_value=decode_return,
            side_effect=decode_side_effect,
        ):
            yield


def test_decode_valid_token_returns_current_user() -> None:
    with _patch_jwt_verification(decode_return=_valid_payload()):
        user = _decode_supabase_access_token(FAKE_BEARER_TOKEN)

    assert user == CurrentUser(sub=str(TEST_AUTH_USER_ID), email="test@example.com")


def test_decode_expired_token_returns_401() -> None:
    with _patch_jwt_verification(decode_side_effect=ExpiredSignatureError("expired")):
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_access_token(FAKE_BEARER_TOKEN)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired token."


def test_decode_invalid_signature_returns_401() -> None:
    with _patch_jwt_verification(
        decode_side_effect=InvalidSignatureError("bad signature"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            _decode_supabase_access_token(FAKE_BEARER_TOKEN)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired token."


@pytest.fixture(name="jwt_client")
def jwt_client_fixture(db_session) -> Generator[TestClient, None, None]:
    """API client that verifies Bearer JWTs (no get_current_user override)."""

    def override_get_session() -> Generator:
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_profiles_list_with_valid_bearer_token(jwt_client: TestClient) -> None:
    with _patch_jwt_verification(decode_return=_valid_payload()):
        response = jwt_client.get(
            "/profiles",
            headers={"Authorization": f"Bearer {FAKE_BEARER_TOKEN}"},
        )

    assert response.status_code == 200
    assert response.json() == []


def test_profiles_list_with_expired_bearer_token_returns_401(
    jwt_client: TestClient,
) -> None:
    with _patch_jwt_verification(decode_side_effect=ExpiredSignatureError("expired")):
        response = jwt_client.get(
            "/profiles",
            headers={"Authorization": f"Bearer {FAKE_BEARER_TOKEN}"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token."


def test_profiles_list_with_invalid_signature_returns_401(
    jwt_client: TestClient,
) -> None:
    with _patch_jwt_verification(
        decode_side_effect=InvalidSignatureError("bad signature"),
    ):
        response = jwt_client.get(
            "/profiles",
            headers={"Authorization": f"Bearer {FAKE_BEARER_TOKEN}"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token."


def test_get_profile_not_owned_with_valid_bearer_returns_404(
    jwt_client: TestClient,
    db_session,
) -> None:
    other_user = User(auth_user_id=uuid.uuid4(), email="other@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_profile = Profile(
        owner_user_id=other_user.id,  # type: ignore[arg-type]
        display_name="Not mine",
        is_self=True,
    )
    db_session.add(other_profile)
    db_session.commit()
    db_session.refresh(other_profile)

    with _patch_jwt_verification(decode_return=_valid_payload()):
        response = jwt_client.get(
            f"/profiles/{other_profile.id}",
            headers={"Authorization": f"Bearer {FAKE_BEARER_TOKEN}"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found."
