from pathlib import PurePosixPath
from datetime import timedelta
from uuid import UUID

from google.cloud import storage
from google.oauth2 import service_account

from app.core.config import settings

# Create the Google client once and reuse it for every upload.
_storage_client: storage.Client | None = None


def _get_storage_client() -> storage.Client:
    global _storage_client
    if _storage_client is not None:
        return _storage_client

    # On your laptop: sign in with the JSON key file in backend/secrets/.
    # In production: Google Cloud signs in automatically (no JSON file needed).
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        credentials = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_APPLICATION_CREDENTIALS
        )
        _storage_client = storage.Client(
            credentials=credentials,
            project=settings.GCP_PROJECT_ID,
        )
    else:
        _storage_client = storage.Client(project=settings.GCP_PROJECT_ID)

    return _storage_client


def _safe_file_name(file_name: str) -> str:
    # Use only the real file name, not folders in the path (stops tricks like "../../other.pdf").
    # Example: "../../secret.pdf" becomes "secret.pdf"
    name = PurePosixPath(file_name.replace("\\", "/")).name.strip()
    return name or "unnamed.pdf"


def upload_profile_pdf(
    *,
    profile_id: UUID,
    document_id: UUID,
    file_name: str,
    contents: bytes,
    mime_type: str,
) -> str:
    safe_name = _safe_file_name(file_name)
    # Where the file lives in the bucket: one folder per profile, then per document.
    object_name = f"profiles/{profile_id}/{document_id}/{safe_name}"
    client = _get_storage_client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(object_name)
    # Send the PDF bytes to Google Cloud Storage.
    blob.upload_from_string(contents, content_type=mime_type)
    # Return the full address so we can save it in the database.
    return f"gs://{settings.GCS_BUCKET_NAME}/{object_name}"


# Delete one file in our bucket using its gs://... path from the database.
def delete_blob_by_gs_uri(gs_uri: str) -> None:
    expected_prefix = f"gs://{settings.GCS_BUCKET_NAME}/"
    if not gs_uri.startswith(expected_prefix):
        raise ValueError("Unsupported GCS URI.")

    object_name = gs_uri.removeprefix(expected_prefix)
    if not object_name:
        raise ValueError("Missing object name in GCS URI.")

    client = _get_storage_client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(object_name)
    blob.delete()


# Build a short-lived URL so private files can be viewed/downloaded safely.
def signed_url_by_gs_uri(
    gs_uri: str,
    *,
    ttl_seconds: int = 900,
    as_download: bool = False,
    file_name: str | None = None,
) -> str:
    expected_prefix = f"gs://{settings.GCS_BUCKET_NAME}/"
    if not gs_uri.startswith(expected_prefix):
        raise ValueError("Unsupported GCS URI.")

    object_name = gs_uri.removeprefix(expected_prefix)
    if not object_name:
        raise ValueError("Missing object name in GCS URI.")

    client = _get_storage_client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(object_name)

    disposition = "inline"
    if as_download:
        # Hint browsers/mobile viewers to download instead of preview.
        export_name = _safe_file_name(file_name or PurePosixPath(object_name).name)
        disposition = f'attachment; filename="{export_name}"'

    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(seconds=ttl_seconds),
        method="GET",
        response_disposition=disposition,
    )
