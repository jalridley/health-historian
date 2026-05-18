import uuid

from sqlmodel import select

from app.models.profile import Profile
from app.models.user import User
from tests.conftest import TEST_AUTH_USER_ID


def test_list_profiles_without_auth_returns_401(anonymous_client):
    response = anonymous_client.get("/profiles")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_list_profiles_creates_app_user_on_first_get(client, db_session):
    response = client.get("/profiles")
    assert response.status_code == 200
    assert response.json() == []

    app_user = db_session.exec(
        select(User).where(User.auth_user_id == TEST_AUTH_USER_ID)
    ).first()
    assert app_user is not None


def test_list_profiles_returns_owned_profiles(client):
    create = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "relationship": "self"},
    )
    assert create.status_code == 201

    response = client.get("/profiles")
    assert response.status_code == 200
    profiles = response.json()
    assert len(profiles) == 1
    assert profiles[0]["display_name"] == "Jane Doe"
    assert profiles[0]["relationship"] == "self"


def test_create_profile_without_auth_returns_401(anonymous_client):
    response = anonymous_client.post(
        "/profiles",
        json={
            "display_name": "Jane Doe",
            "relationship": "self",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_create_profile_invalid_body_returns_422(client):
    response = client.post(
        "/profiles",
        json={
            "relationship": "self",
        },
    )
    assert response.status_code == 422


def test_create_profile_returns_201_and_sets_owner(client, db_session):
    response = client.post(
        "/profiles",
        json={
            "display_name": "Jane Doe",
            "relationship": "self",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["display_name"] == "Jane Doe"
    assert body["relationship"] == "self"
    assert uuid.UUID(body["id"])

    app_user = db_session.exec(
        select(User).where(User.auth_user_id == TEST_AUTH_USER_ID)
    ).one()
    profile = db_session.exec(
        select(Profile).where(Profile.id == uuid.UUID(body["id"]))
    ).one()
    assert profile.owner_user_id == app_user.id
    assert profile.relation == "self"


def test_create_second_profile_for_same_user_returns_201(client):
    first = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "relationship": "self"},
    )
    second = client.post(
        "/profiles",
        json={"display_name": "Mom", "relationship": "parent"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
