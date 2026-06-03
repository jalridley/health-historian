import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.api.deps import get_owned_profile
from app.db.session import get_session
from app.models.document import Document
from app.models.profile import Profile
from app.schemas.document import DocumentAccessUrl, DocumentPublic
from app.services.gcs import delete_blob_by_gs_uri, signed_url_by_gs_uri, upload_profile_pdf

router = APIRouter(
    prefix="/profiles/{profile_id}/documents",
    tags=["documents"],
)

ALLOWED_MIME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _document_to_public(doc: Document) -> DocumentPublic:
    # "Public" here means the API-safe view returned to frontend clients
    # (no storage URI, checksum, or other internal-only fields).
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unsupported file type: {file.content_type}. Only PDF is accepted.",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds {MAX_FILE_SIZE // (1024 * 1024)} MB limit.",
        )

    checksum = hashlib.sha256(contents).hexdigest()
    # Fast app-level check so users get a clear message before we hit storage/database.
    duplicate = session.exec(
        select(Document).where(
            Document.profile_id == profile.id,
            Document.checksum == checksum,
        )
    ).first()
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This file already exists for this profile.",
        )

    file_name = file.filename or "unnamed.pdf"
    mime_type = file.content_type or "application/pdf"
    document_id = uuid.uuid4()

    try:
        gcs_uri = upload_profile_pdf(
            profile_id=profile.id,  # type: ignore[arg-type]
            document_id=document_id,
            file_name=file_name,
            contents=contents,
            mime_type=mime_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not store document.",
        ) from exc

    document = Document(
        id=document_id,
        profile_id=profile.id,  # type: ignore[arg-type]
        uploader_user_id=profile.owner_user_id,
        file_name=file_name,
        gcs_uri=gcs_uri,
        mime_type=mime_type,
        byte_size=len(contents),
        checksum=checksum,
    )

    session.add(document)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # DB-level duplicate guard handles race conditions (two same uploads at once).
        try:
            delete_blob_by_gs_uri(gcs_uri)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This file already exists for this profile.",
        ) from exc
    session.refresh(document)
    return _document_to_public(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    document = session.exec(
        select(Document).where(
            Document.id == document_id,
            Document.profile_id == profile.id,
        )
    ).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    if not document.gcs_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document has no storage URI.",
        )

    try:
        delete_blob_by_gs_uri(document.gcs_uri)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not delete document from storage.",
        ) from exc

    session.delete(document)
    session.commit()


@router.get("/{document_id}/access-url", response_model=DocumentAccessUrl)
def get_document_access_url(
    document_id: uuid.UUID,
    profile: Annotated[Profile, Depends(get_owned_profile)],
    session: Annotated[Session, Depends(get_session)],
    download: bool = False,
) -> DocumentAccessUrl:
    document = session.exec(
        select(Document).where(
            Document.id == document_id,
            Document.profile_id == profile.id,
        )
    ).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    if not document.gcs_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document has no storage URI.",
        )

    try:
        # One endpoint for both "view" and "download" behavior.
        url = signed_url_by_gs_uri(
            document.gcs_uri,
            as_download=download,
            file_name=document.file_name,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not prepare document access URL.",
        ) from exc

    return DocumentAccessUrl(url=url)
