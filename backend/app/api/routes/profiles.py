from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_owned_profile, profile_to_public
from app.auth import CurrentUser, get_current_user
from app.db.session import get_session
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfilePublic, ProfileUpdate
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


@router.get("/{profile_id}", response_model=ProfilePublic)
def get_profile(
    profile: Annotated[Profile, Depends(get_owned_profile)],
) -> ProfilePublic:
    return profile_to_public(profile)


@router.patch("/{profile_id}", response_model=ProfilePublic)
def update_profile(
    body: ProfileUpdate,
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
) -> ProfilePublic:
    if body.display_name is not None:
        display_name = body.display_name.strip()
        if not display_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="display_name cannot be empty.",
            )
        profile.display_name = display_name
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile_to_public(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    if profile.is_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete your account profile.",
        )
    session.delete(profile)
    session.commit()


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
    if body.is_self:
        existing_self = session.exec(
            select(Profile).where(
                Profile.owner_user_id == app_user.id,
                Profile.is_self == True,  # noqa: E712
            )
        ).first()
        if existing_self is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Self profile already exists.",
            )
    profile = Profile(
        owner_user_id=app_user.id,  # type: ignore[arg-type]
        display_name=body.display_name.strip(),
        is_self=body.is_self,
        dob=body.dob,
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile_to_public(profile)
