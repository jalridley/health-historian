from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentPublic(BaseModel):
    id: UUID
    profile_id: UUID
    file_name: str
    mime_type: str
    byte_size: int
    created_at: datetime

    model_config = {"from_attributes": True}
