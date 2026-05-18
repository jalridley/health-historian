from fastapi import APIRouter

from app.api.routes import profiles

api_router = APIRouter()
api_router.include_router(profiles.router)
