'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  deleteProfileDocument,
  getProfileDocumentAccessUrl,
  getProfile,
  listDocuments,
  uploadProfileDocument,
  type DocumentPublic,
  type ProfilePublic,
} from '@/lib/api';
import { formatBytes } from '@/lib/format-bytes';
import { formatUploadDate } from '@/lib/format-upload-date';
import { requireAccessToken } from '@/lib/auth';

type DocumentsListProps = {
  profileId: string;
  onError?: (message: string) => void;
};

export const DocumentsList = ({ profileId, onError }: DocumentsListProps) => {
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [documents, setDocuments] = useState<DocumentPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const reportError = useCallback((err: unknown, fallback: string) => {
    const detail = err instanceof Error ? err.message : fallback;
    onErrorRef.current?.(detail);
  }, []);

  const loadProfileAndDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const accessToken = await requireAccessToken();
      const [profileResult, docs] = await Promise.all([
        getProfile(accessToken, profileId),
        listDocuments(accessToken, profileId),
      ]);
      setProfile(profileResult);
      setDocuments(docs);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Could not load documents.';
      setLoadError(detail);
      setProfile(null);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadProfileAndDocuments();
  }, [loadProfileAndDocuments]);

  const handleAddDocuments = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    // Snapshot chosen files before any await. e.target.files is a live FileList tied to
    // the <input>: clearing the input (see finally below) or DOM updates can empty or
    // change it while uploads run. Copy into a plain array now so the loop below always
    // sees what the user picked. Use Array.from — FileList is array-like, not a real
    // array, so .map() and other array methods are not available on it.
    const filesToUpload = Array.from(e.target.files ?? []);
    if (filesToUpload.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const accessToken = await requireAccessToken();
      const failures: string[] = [];
      for (const file of filesToUpload) {
        try {
          await uploadProfileDocument(accessToken, profileId, file);
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Upload failed.';
          failures.push(`${file.name}: ${detail}`);
        }
      }
      const docs = await listDocuments(accessToken, profileId);
      setDocuments(docs);
      if (failures.length > 0) {
        reportError(
          new Error(failures.join(' ')),
          'Some document(s) could not be uploaded.',
        );
      }
    } catch (err) {
      reportError(err, 'Could not upload document(s).');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // TODO: confirm dialog before delete
  const handleDeleteDocument = async (documentId: string) => {
    setDeletingDocumentId(documentId);
    try {
      const accessToken = await requireAccessToken();
      await deleteProfileDocument(accessToken, profileId, documentId);
      const docs = await listDocuments(accessToken, profileId);
      setDocuments(docs);
    } catch (err) {
      reportError(err, 'Could not delete document.');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleOpenDocument = async (doc: DocumentPublic, download: boolean) => {
    setOpeningDocumentId(doc.id);
    try {
      const accessToken = await requireAccessToken();
      const { url } = await getProfileDocumentAccessUrl(
        accessToken,
        profileId,
        doc.id,
        download,
      );

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      reportError(err, `Could not ${download ? 'download' : 'open'} document.`);
    } finally {
      setOpeningDocumentId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (loadError) {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Documents</h1>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="xs" asChild>
              <Link href={`/profiles/${profileId}/chat`}>Chat</Link>
            </Button>
            <Button type="button" variant="outline" size="xs" asChild>
              <Link href="/profiles">All profiles</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf"
        multiple
        onChange={handleFilesSelected}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {profile ? `${profile.display_name} — Documents` : 'Documents'}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" asChild>
            <Link href={`/profiles/${profileId}/chat`}>Chat</Link>
          </Button>
          <Button type="button" variant="outline" size="xs" asChild>
            <Link href="/profiles">All profiles</Link>
          </Button>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={handleAddDocuments}
      >
        {uploading ? 'Uploading…' : 'Add document(s)'}
      </Button>

      <ul className="space-y-1">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded-md border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.file_name}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Date uploaded: {formatUploadDate(doc.created_at)} ·{' '}
                  {formatBytes(doc.byte_size)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={openingDocumentId === doc.id}
                onClick={() => void handleOpenDocument(doc, false)}
              >
                {openingDocumentId === doc.id ? 'Opening…' : 'View'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={openingDocumentId === doc.id}
                onClick={() => void handleOpenDocument(doc, true)}
              >
                {openingDocumentId === doc.id ? 'Opening…' : 'Download'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={deletingDocumentId === doc.id}
                onClick={() => void handleDeleteDocument(doc.id)}
              >
                {deletingDocumentId === doc.id ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
