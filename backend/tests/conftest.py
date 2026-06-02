import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Set test env before app imports so Settings() loads these values.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SUPABASE_JWKS_URL"] = "https://127.0.0.1:9/jwks.json"
os.environ["SUPABASE_JWT_ISSUER"] = "https://example.invalid/auth/v1"
os.environ["GCP_PROJECT_ID"] = "test-project"
os.environ["GCS_BUCKET_NAME"] = "test-bucket"

from app import auth
from app.auth import CurrentUser, get_current_user
from app.db import session as db_session_module
from app.db.session import get_session
from app.main import app
from app.models import Document, Profile, User  # noqa: F401

TEST_AUTH_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

_APP_TABLES = [User.__table__, Profile.__table__, Document.__table__]


@pytest.fixture(autouse=True)
def reset_jwks_cache() -> Generator[None, None, None]:
    auth.reset_jwk_client_cache()
    yield
    auth.reset_jwk_client_cache()


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _sqlite_disable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    SQLModel.metadata.create_all(engine, tables=_APP_TABLES)
    db_session_module._engine = engine
    yield engine
    SQLModel.metadata.drop_all(engine, tables=_APP_TABLES)
    db_session_module._engine = None


@pytest.fixture(name="db_session")
def db_session_fixture(engine) -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture(name="client")
def client_fixture(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_session() -> Generator[Session, None, None]:
        yield db_session

    def override_get_current_user() -> CurrentUser:
        return CurrentUser(
            sub=str(TEST_AUTH_USER_ID),
            email="test@example.com",
        )

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="anonymous_client")
def anonymous_client_fixture() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
