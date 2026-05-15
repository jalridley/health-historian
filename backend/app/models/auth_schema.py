"""Read-only metadata stub for Supabase Auth tables (not owned by this app)."""

from sqlalchemy import Column, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlmodel import SQLModel

# Lets SQLAlchemy resolve users.auth_user_id -> auth.users.id for Alembic autogenerate.
# Migrations must not create or alter auth schema (see alembic/env.py include_object).
Table(
    "users",
    SQLModel.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
    info={"is_auth_stub": True},
)
