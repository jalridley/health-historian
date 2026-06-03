import uuid
from unittest.mock import patch

from sqlmodel import select

from app.models.document import Document
from app.models.profile import Profile
from app.models.user import User

PDF_BYTES = b"%PDF-1.4 test content"
MAX_FILE_SIZE = 20 * 1024 * 1024


def _create_owned_profile(client) -> str:
    response = client.post(
        "/profiles",
        json={"display_name": "Jane Doe", "is_self": True},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _upload_url(profile_id: str) -> str:
    return f"/profiles/{profile_id}/documents/upload"


def _list_url(profile_id: str) -> str:
    return f"/profiles/{profile_id}/documents"


def _document_url(profile_id: str, document_id: str) -> str:
    return f"/profiles/{profile_id}/documents/{document_id}"


def _access_url(profile_id: str, document_id: str, download: bool = False) -> str:
    suffix = "?download=true" if download else ""
    return f"/profiles/{profile_id}/documents/{document_id}/access-url{suffix}"


def test_upload_document_without_auth_returns_401(anonymous_client):
    profile_id = "22222222-2222-2222-2222-222222222222"
    response = anonymous_client.post(
        _upload_url(profile_id),
        files={"file": ("test.pdf", PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_upload_document_unsupported_mime_returns_422(client):
    profile_id = _create_owned_profile(client)

    response = client.post(
        _upload_url(profile_id),
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 422
    assert "Only PDF is accepted" in response.json()["detail"]


def test_upload_document_exceeds_size_limit_returns_413(client):
    profile_id = _create_owned_profile(client)
    oversized = b"x" * (MAX_FILE_SIZE + 1)

    response = client.post(
        _upload_url(profile_id),
        files={"file": ("big.pdf", oversized, "application/pdf")},
    )
    assert response.status_code == 413
    assert "20 MB limit" in response.json()["detail"]


def test_upload_document_not_owned_profile_returns_404(client, db_session):
    other_user = User(auth_user_id=uuid.uuid4(), email="other@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_profile = Profile(
        owner_user_id=other_user.id,  # type: ignore[arg-type]
        display_name="Not mine",
        is_self=True,
    )
    db_session.add(other_profile)
    db_session.commit()
    db_session.refresh(other_profile)

    response = client.post(
        _upload_url(str(other_profile.id)),
        files={"file": ("test.pdf", PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found."


@patch("app.api.routes.documents.upload_profile_pdf")
def test_upload_document_success_returns_201(mock_upload, client, db_session):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    profile_id = _create_owned_profile(client)

    response = client.post(
        _upload_url(profile_id),
        files={"file": ("test.pdf", PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["file_name"] == "test.pdf"
    assert body["mime_type"] == "application/pdf"
    assert body["byte_size"] == len(PDF_BYTES)
    assert body["profile_id"] == profile_id

    document = db_session.exec(
        select(Document).where(Document.id == uuid.UUID(body["id"]))
    ).one()
    assert document.gcs_uri == mock_upload.return_value
    assert document.checksum is not None
    mock_upload.assert_called_once()


@patch("app.api.routes.documents.upload_profile_pdf")
def test_upload_duplicate_document_same_profile_returns_409(mock_upload, client):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    profile_id = _create_owned_profile(client)

    first = client.post(
        _upload_url(profile_id),
        files={"file": ("test.pdf", PDF_BYTES, "application/pdf")},
    )
    second = client.post(
        _upload_url(profile_id),
        files={"file": ("test-copy.pdf", PDF_BYTES, "application/pdf")},
    )
    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "This file already exists for this profile."
    # Duplicate is blocked before any second storage upload.
    assert mock_upload.call_count == 1


def test_list_documents_not_owned_profile_returns_404(client, db_session):
    other_user = User(auth_user_id=uuid.uuid4(), email="other@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_profile = Profile(
        owner_user_id=other_user.id,  # type: ignore[arg-type]
        display_name="Not mine",
        is_self=True,
    )
    db_session.add(other_profile)
    db_session.commit()
    db_session.refresh(other_profile)

    response = client.get(_list_url(str(other_profile.id)))
    assert response.status_code == 404


@patch("app.api.routes.documents.upload_profile_pdf")
def test_list_documents_returns_owned_documents(mock_upload, client):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    profile_id = _create_owned_profile(client)

    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201

    response = client.get(_list_url(profile_id))
    assert response.status_code == 200
    documents = response.json()
    assert len(documents) == 1
    assert documents[0]["file_name"] == "lab.pdf"


@patch("app.api.routes.documents.delete_blob_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_delete_document_success_returns_204(mock_upload, mock_delete_blob, client, db_session):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    profile_id = _create_owned_profile(client)

    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.delete(_document_url(profile_id, document_id))
    assert response.status_code == 204

    remaining = db_session.exec(
        select(Document).where(Document.id == uuid.UUID(document_id))
    ).first()
    assert remaining is None
    mock_delete_blob.assert_called_once()


@patch("app.api.routes.documents.delete_blob_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_delete_document_not_found_returns_404(mock_upload, mock_delete_blob, client):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    profile_id = _create_owned_profile(client)
    unknown_document_id = "22222222-2222-2222-2222-222222222222"

    response = client.delete(_document_url(profile_id, unknown_document_id))
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found."
    mock_delete_blob.assert_not_called()


@patch("app.api.routes.documents.upload_profile_pdf")
def test_delete_document_not_owned_profile_returns_404(mock_upload, client, db_session):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    other_user = User(auth_user_id=uuid.uuid4(), email="other@example.com")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_profile = Profile(
        owner_user_id=other_user.id,  # type: ignore[arg-type]
        display_name="Not mine",
        is_self=True,
    )
    db_session.add(other_profile)
    db_session.commit()
    db_session.refresh(other_profile)

    response = client.delete(
        _document_url(
            str(other_profile.id),
            "22222222-2222-2222-2222-222222222222",
        )
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found."


@patch("app.api.routes.documents.delete_blob_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_delete_document_storage_failure_returns_503(
    mock_upload, mock_delete_blob, client, db_session
):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/test.pdf"
    mock_delete_blob.side_effect = RuntimeError("gcs down")
    profile_id = _create_owned_profile(client)

    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.delete(_document_url(profile_id, document_id))
    assert response.status_code == 503
    assert response.json()["detail"] == "Could not delete document from storage."

    still_there = db_session.exec(
        select(Document).where(Document.id == uuid.UUID(document_id))
    ).first()
    assert still_there is not None


@patch("app.api.routes.documents.signed_url_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_get_document_access_url_returns_200(mock_upload, mock_signed_url, client):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/lab.pdf"
    mock_signed_url.return_value = "https://example.test/signed"
    profile_id = _create_owned_profile(client)
    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.get(_access_url(profile_id, document_id))
    assert response.status_code == 200
    assert response.json()["url"] == "https://example.test/signed"
    mock_signed_url.assert_called_once()


@patch("app.api.routes.documents.signed_url_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_get_document_access_url_download_mode(mock_upload, mock_signed_url, client):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/lab.pdf"
    mock_signed_url.return_value = "https://example.test/signed-download"
    profile_id = _create_owned_profile(client)
    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.get(_access_url(profile_id, document_id, download=True))
    assert response.status_code == 200
    assert response.json()["url"] == "https://example.test/signed-download"
    _, kwargs = mock_signed_url.call_args
    assert kwargs["as_download"] is True


@patch("app.api.routes.documents.signed_url_by_gs_uri")
def test_get_document_access_url_not_found_returns_404(mock_signed_url, client):
    profile_id = _create_owned_profile(client)
    response = client.get(
        _access_url(profile_id, "22222222-2222-2222-2222-222222222222")
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found."
    mock_signed_url.assert_not_called()


@patch("app.api.routes.documents.signed_url_by_gs_uri")
@patch("app.api.routes.documents.upload_profile_pdf")
def test_get_document_access_url_storage_failure_returns_503(
    mock_upload, mock_signed_url, client
):
    mock_upload.return_value = "gs://test-bucket/profiles/test/doc/lab.pdf"
    mock_signed_url.side_effect = RuntimeError("sign error")
    profile_id = _create_owned_profile(client)
    upload = client.post(
        _upload_url(profile_id),
        files={"file": ("lab.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201
    document_id = upload.json()["id"]

    response = client.get(_access_url(profile_id, document_id))
    assert response.status_code == 503
    assert response.json()["detail"] == "Could not prepare document access URL."
