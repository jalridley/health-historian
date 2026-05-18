import uuid

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.auth import CurrentUser
from app.models.user import User


def get_or_create_app_user(session: Session, current_user: CurrentUser) -> User:
    try:
        auth_user_id = uuid.UUID(current_user.sub)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims.",
        ) from exc

    app_user = session.exec(
        select(User).where(User.auth_user_id == auth_user_id)
    ).first()
    if app_user is not None:
        return app_user

    app_user = User(auth_user_id=auth_user_id, email=current_user.email)
    session.add(app_user)
    session.commit()
    session.refresh(app_user)
    return app_user
