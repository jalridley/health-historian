"""replace relationship with is_self

Revision ID: a1b2c3d4e5f6
Revises: 8699142ccba4
Create Date: 2026-05-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8699142ccba4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dev/test data may have multiple relationship='self' rows per user; keep oldest.
    op.execute(
        sa.text(
            """
            DELETE FROM profiles
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY owner_user_id
                               ORDER BY created_at ASC, id ASC
                           ) AS rn
                    FROM profiles
                    WHERE relationship = 'self'
                ) ranked
                WHERE rn > 1
            )
            """
        )
    )
    op.add_column(
        "profiles",
        sa.Column("is_self", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute(
        sa.text("UPDATE profiles SET is_self = true WHERE relationship = 'self'")
    )
    op.drop_column("profiles", "relationship")
    op.create_index(
        "ix_profiles_owner_user_id_is_self",
        "profiles",
        ["owner_user_id"],
        unique=True,
        postgresql_where=sa.text("is_self IS TRUE"),
    )


def downgrade() -> None:
    op.drop_index("ix_profiles_owner_user_id_is_self", table_name="profiles")
    op.add_column(
        "profiles",
        sa.Column("relationship", sa.String(length=64), nullable=False, server_default="family"),
    )
    op.execute(
        sa.text(
            "UPDATE profiles SET relationship = CASE WHEN is_self THEN 'self' ELSE 'family' END"
        )
    )
    op.drop_column("profiles", "is_self")
