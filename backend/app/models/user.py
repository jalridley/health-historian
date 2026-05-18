from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    auth_user_id: uuid.UUID = Field(
        foreign_key="auth.users.id",
        unique=True,
        index=True,
    )
    email: str | None = Field(default=None, max_length=320)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[arg-type]
    )
