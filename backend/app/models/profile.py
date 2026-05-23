import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

from app.models.user import _utc_now


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    display_name: str = Field(max_length=255)
    is_self: bool = Field(default=False, index=True)
    dob: date | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[arg-type]
    )
