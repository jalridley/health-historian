"""add document profile/checksum unique index

Revision ID: f1c2d3e4a5b6
Revises: cca462f9b340
Create Date: 2026-06-02 14:32:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1c2d3e4a5b6"
down_revision: Union[str, Sequence[str], None] = "cca462f9b340"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        "ix_documents_profile_id_checksum_unique",
        "documents",
        ["profile_id", "checksum"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_documents_profile_id_checksum_unique", table_name="documents")
