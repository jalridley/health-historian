import uuid
from datetime import date, datetime, timezone

from sqlalchemy import DateTime, Index, text
from sqlmodel import Field, SQLModel

from app.models.user import _utc_now


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    __table_args__ = (
        Index(
            "ix_profiles_owner_user_id_is_self",
            "owner_user_id",
            unique=True,
            postgresql_where=text("is_self IS TRUE"),
        ),
    )

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    display_name: str = Field(max_length=255)
    is_self: bool = Field(default=False)
    dob: date | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[arg-type]
    )
