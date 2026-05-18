from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.api.deps import profile_to_public
from app.auth import CurrentUser, get_current_user
from app.db.session import get_session
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfilePublic
from app.services.users import get_or_create_app_user

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfilePublic])
def list_profiles(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ProfilePublic]:
    app_user = get_or_create_app_user(session, current_user)
    profiles = session.exec(
        select(Profile).where(Profile.owner_user_id == app_user.id)
    ).all()
    return [profile_to_public(profile) for profile in profiles]


@router.post(
    "",
    response_model=ProfilePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    body: ProfileCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> ProfilePublic:
    app_user = get_or_create_app_user(session, current_user)
    profile = Profile(
        owner_user_id=app_user.id,  # type: ignore[arg-type]
        display_name=body.display_name.strip(),
        relation=body.relationship.strip(),
        dob=body.dob,
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile_to_public(profile)
