from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_me_without_authorization_returns_401():
    response = client.get("/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_me_with_invalid_jwt_returns_401():
    response = client.get(
        "/me",
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token."
