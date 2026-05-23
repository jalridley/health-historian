from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlmodel import Session

from app.auth import CurrentUser, get_current_user
from app.db.session import get_session
from app.models.profile import Profile
from app.schemas.profile import ProfilePublic
from app.services.users import get_or_create_app_user


def profile_to_public(profile: Profile) -> ProfilePublic:
    return ProfilePublic(
        id=profile.id,  # type: ignore[arg-type]
        display_name=profile.display_name,
        is_self=profile.is_self,
        dob=profile.dob,
        created_at=profile.created_at,
    )


def get_owned_profile(
    profile_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> Profile:
    app_user = get_or_create_app_user(session, current_user)
    profile = session.get(Profile, profile_id)
    if profile is None or profile.owner_user_id != app_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        )
    return profile
