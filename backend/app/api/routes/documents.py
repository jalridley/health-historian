import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.api.deps import get_owned_profile
from app.db.session import get_session
from app.models.document import Document
from app.models.profile import Profile
from app.schemas.document import DocumentPublic

router = APIRouter(
    prefix="/profiles/{profile_id}/documents",
    tags=["documents"],
)

ALLOWED_MIME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _document_to_public(doc: Document) -> DocumentPublic:
    return DocumentPublic(
        id=doc.id,  # type: ignore[arg-type]
        profile_id=doc.profile_id,
        file_name=doc.file_name,
        mime_type=doc.mime_type,
        byte_size=doc.byte_size,
        created_at=doc.created_at,
    )


@router.get("", response_model=list[DocumentPublic])
def list_documents(
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
) -> list[DocumentPublic]:
    docs = session.exec(
        select(Document)
        .where(Document.profile_id == profile.id)
        .order_by(Document.created_at.desc())  # type: ignore[union-attr]
    ).all()
    return [_document_to_public(doc) for doc in docs]


@router.post(
    "/upload",
    response_model=DocumentPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile,
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
) -> DocumentPublic:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type: {file.content_type}. Only PDF is accepted.",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_FILE_SIZE // (1024 * 1024)} MB limit.",
        )

    checksum = hashlib.sha256(contents).hexdigest()

    # TODO: upload to GCS once storage is configured (Milestone 3 continuation)
    gcs_uri = None

    document = Document(
        profile_id=profile.id,  # type: ignore[arg-type]
        uploader_user_id=profile.owner_user_id,
        file_name=file.filename or "unnamed.pdf",
        gcs_uri=gcs_uri,
        mime_type=file.content_type or "application/pdf",
        byte_size=len(contents),
        checksum=checksum,
    )

    session.add(document)
    session.commit()
    session.refresh(document)
    return _document_to_public(document)
