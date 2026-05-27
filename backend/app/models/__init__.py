# Import all table models so SQLModel.metadata is complete for Alembic autogenerate.
from app.models import auth_schema as auth_schema  # noqa: F401 — registers auth.users stub
from app.models.document import Document as Document
from app.models.profile import Profile as Profile
from app.models.user import User as User

__all__ = ["User", "Profile", "Document"]
