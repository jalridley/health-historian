from typing import Annotated

from fastapi import Depends, FastAPI

from app.auth import CurrentUser, get_current_user

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me")
def read_me(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict[str, str | None]:
    return {"sub": user.sub, "email": user.email}