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
        json={"display_name": "Jane Doe", "is_self": True},
    )
    assert create.status_code == 201

    response = client.get("/profiles")
    assert response.status_code == 200
    profiles = response.json()
    assert len(profiles) == 1
    assert profiles[0]["display_name"] == "Jane Doe"
    assert profiles[0]["is_self"] is True


def test_create_profile_without_auth_returns_401(anonymous_client):
    response = anonymous_client.post(
        "/profiles",
        json={
            "display_name": "Jane Doe",
            "is_self": True,
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_create_profile_invalid_body_returns_422(client):
    response = client.post(
        "/profiles",
        json={
            "is_self": True,
        },
    )
    assert response.status_code == 422


def test_create_profile_returns_201_and_sets_owner(client, db_session):
    response = client.post(
        "/profiles",
        json={
            "display_name": "Jane Doe",
            "is_self": True,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["display_name"] == "Jane Doe"
    assert body["is_self"] is True
    assert uuid.UUID(body["id"])

    app_user = db_session.exec(
        select(User).where(User.auth_user_id == TEST_AUTH_USER_ID)
    ).one()
    profile = db_session.exec(
        select(Profile).where(Profile.id == uuid.UUID(body["id"]))
    ).one()
    assert profile.owner_user_id == app_user.id
    assert profile.is_self is True


def test_create_second_self_profile_returns_409(client):
    first = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    second = client.post(
        "/profiles",
        json={"display_name": "Jane Again", "is_self": True},
    )
    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Self profile already exists."


def test_create_second_non_self_profile_returns_201(client):
    first = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    second = client.post(
        "/profiles",
        json={"display_name": "Mom"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert second.json()["is_self"] is False


def test_get_profile_without_auth_returns_401(anonymous_client):
    profile_id = "22222222-2222-2222-2222-222222222222"
    response = anonymous_client.get(f"/profiles/{profile_id}")
    assert response.status_code == 401


def test_get_profile_not_owned_returns_404(client, db_session):
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

    response = client.get(f"/profiles/{other_profile.id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found."


def test_get_profile_returns_owned_profile(client):
    created = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    profile_id = created.json()["id"]

    response = client.get(f"/profiles/{profile_id}")
    assert response.status_code == 200
    assert response.json()["display_name"] == "Jane Doe"


def test_update_profile_display_name(client):
    created = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    profile_id = created.json()["id"]

    response = client.patch(
        f"/profiles/{profile_id}",
        json={"display_name": "Jane D."},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Jane D."


def test_update_profile_empty_display_name_returns_422(client):
    created = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    profile_id = created.json()["id"]

    response = client.patch(
        f"/profiles/{profile_id}",
        json={"display_name": "   "},
    )
    assert response.status_code == 422


def test_update_profile_not_owned_returns_404(client, db_session):
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

    response = client.patch(
        f"/profiles/{other_profile.id}",
        json={"display_name": "Hacked"},
    )
    assert response.status_code == 404


def test_delete_profile_without_auth_returns_401(anonymous_client):
    profile_id = "22222222-2222-2222-2222-222222222222"
    response = anonymous_client.delete(f"/profiles/{profile_id}")
    assert response.status_code == 401


def test_delete_self_profile_returns_403(client):
    created = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    profile_id = created.json()["id"]

    response = client.delete(f"/profiles/{profile_id}")
    assert response.status_code == 403
    assert response.json()["detail"] == "Cannot delete your account profile."


def test_delete_non_self_profile_returns_204(client, db_session):
    self_created = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    other_created = client.post(
        "/profiles",
        json={"display_name": "Mom"},
    )
    other_id = uuid.UUID(other_created.json()["id"])

    response = client.delete(f"/profiles/{other_id}")
    assert response.status_code == 204

    remaining = db_session.exec(select(Profile)).all()
    assert len(remaining) == 1
    assert remaining[0].id == uuid.UUID(self_created.json()["id"])


def test_delete_profile_not_owned_returns_404(client, db_session):
    other_user = User(auth_user_id=uuid.uuid4(), email="other@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_profile = Profile(
        owner_user_id=other_user.id,  # type: ignore[arg-type]
        display_name="Not mine",
        is_self=False,
    )
    db_session.add(other_profile)
    db_session.commit()
    db_session.refresh(other_profile)

    response = client.delete(f"/profiles/{other_profile.id}")
    assert response.status_code == 404
