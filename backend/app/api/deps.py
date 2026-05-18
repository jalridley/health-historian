from app.models.profile import Profile
from app.schemas.profile import ProfilePublic


def profile_to_public(profile: Profile) -> ProfilePublic:
    return ProfilePublic(
        id=profile.id,  # type: ignore[arg-type]
        display_name=profile.display_name,
        relationship=profile.relation,
        dob=profile.dob,
        created_at=profile.created_at,
    )
