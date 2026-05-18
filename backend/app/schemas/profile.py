from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    relationship: str = Field(min_length=1, max_length=64)
    dob: date | None = None


class ProfilePublic(BaseModel):
    id: UUID
    display_name: str
    relationship: str
    dob: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
