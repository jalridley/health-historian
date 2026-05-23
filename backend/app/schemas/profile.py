from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    is_self: bool = False
    dob: date | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)


class ProfilePublic(BaseModel):
    id: UUID
    display_name: str
    is_self: bool
    dob: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
