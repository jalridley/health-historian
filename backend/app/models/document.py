import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index
from sqlmodel import Field, SQLModel

from app.models.user import _utc_now


class Document(SQLModel, table=True):
    __tablename__ = "documents"
    __table_args__ = (
        # Enforce "same profile + same file checksum" uniqueness at DB level.
        # This is the final safeguard against duplicates, including race conditions.
        Index(
            "ix_documents_profile_id_checksum_unique",
            "profile_id",
            "checksum",
            unique=True,
        ),
    )

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.id", index=True)
    uploader_user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    file_name: str = Field(max_length=512)
    gcs_uri: str | None = Field(default=None, max_length=1024)
    mime_type: str = Field(max_length=128)
    byte_size: int
    checksum: str | None = Field(default=None, max_length=128)
    gemini_file_id: str | None = Field(default=None, max_length=512)
    gemini_store_id: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[arg-type]
    )
