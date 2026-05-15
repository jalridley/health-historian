import uuid
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, Relationship, SQLModel

from app.models.user import _utc_now

if TYPE_CHECKING:
    from app.models.user import User


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    display_name: str = Field(max_length=255)
    # DB column is "relationship"; avoid SQLModel's Relationship() name clash.
    relation: str = Field(sa_column=Column("relationship", String(64), nullable=False))
    dob: date | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[arg-type]
    )

    owner: "User | None" = Relationship(back_populates="profiles")
