from fastapi import APIRouter

from app.api.routes import documents, profiles

api_router = APIRouter()
api_router.include_router(profiles.router)
api_router.include_router(documents.router)
