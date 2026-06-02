'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import {
  createProfile,
  deleteProfileDocument,
  deleteProfile,
  ensureSelfProfile,
  listDocuments,
  listProfiles,
  readStoredSelectedProfileId,
  resolveSelectedProfile,
  sortProfilesForDisplay,
  updateProfile,
  uploadProfileDocument,
  writeStoredSelectedProfileId,
  type DocumentPublic,
  type ProfilePublic,
} from '@/lib/api';
import { requireAccessToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type ProfileNameFormValues = {
  display_name: string;
};

const DISPLAY_NAME_RULES = {
  required: 'Name is required.',
  minLength: {
    value: 1,
    message: 'Name is required.',
  },
  maxLength: {
    value: 255,
    message: 'Name must be at most 255 characters.',
  },
} as const;

type ProfilesPanelProps = {
  onError?: (message: string) => void;
};

const profileButtonClass = (
  profileId: string,
  selectedProfileId: string | null,
) => {
  const selected = selectedProfileId === profileId;
  return selected
    ? 'w-full rounded-md border border-zinc-900 bg-zinc-100 px-3 py-2 text-left text-sm font-medium dark:border-zinc-100 dark:bg-zinc-800'
    : 'w-full rounded-md border border-transparent px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800';
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
};

export const ProfilesPanel = ({ onError }: ProfilesPanelProps) => {
  const [profiles, setProfiles] = useState<ProfilePublic[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [documents, setDocuments] = useState<DocumentPublic[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingProfileId, setUploadingProfileId] = useState<string | null>(
    null,
  );
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileNameFormValues>({
    defaultValues: { display_name: '' },
  });
  const {
    register: registerRename,
    handleSubmit: handleRenameSubmit,
    reset: resetRename,
    formState: { errors: renameErrors },
  } = useForm<ProfileNameFormValues>({
    defaultValues: { display_name: '' },
  });

  const applyProfiles = useCallback((list: ProfilePublic[]) => {
    setProfiles(list);
    const storedId = readStoredSelectedProfileId();
    const selected = resolveSelectedProfile(list, storedId);
    if (selected) {
      setSelectedProfileId(selected.id);
      writeStoredSelectedProfileId(selected.id);
    } else {
      setSelectedProfileId(null);
    }
  }, []);

  const reloadProfiles = useCallback(
    async (accessToken: string) => {
      const list = await listProfiles(accessToken);
      applyProfiles(list);
    },
    [applyProfiles],
  );

  const reportError = useCallback(
    (err: unknown, fallback: string) => {
      const detail = err instanceof Error ? err.message : fallback;
      onError?.(detail);
    },
    [onError],
  );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      onError?.(error.message);
      setProfiles([]);
      setSelectedProfileId(null);
      setLoading(false);
      return;
    }

    const session = data.session;
    if (!session?.access_token) {
      setProfiles([]);
      setSelectedProfileId(null);
      setLoading(false);
      return;
    }

    try {
      const list = await ensureSelfProfile(session);
      applyProfiles(list);
    } catch (err) {
      reportError(err, 'Could not load profiles.');
      setProfiles([]);
      setSelectedProfileId(null);
    } finally {
      setLoading(false);
    }
  }, [applyProfiles, onError, reportError]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDocProfileRef = useRef<string | null>(null);

  const handleAddDocuments = (profileId: string) => {
    setSelectedProfileId(profileId);
    writeStoredSelectedProfileId(profileId);
    addDocProfileRef.current = profileId;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const profileId = addDocProfileRef.current;
    if (!files || files.length === 0 || !profileId) {
      return;
    }
    setUploadingProfileId(profileId);
    try {
      const accessToken = await requireAccessToken();
      for (const file of Array.from(files)) {
        await uploadProfileDocument(accessToken, profileId, file);
      }
      const docs = await listDocuments(accessToken, profileId);
      setDocuments(docs);
    } catch (err) {
      reportError(err, 'Could not upload document(s).');
    } finally {
      setUploadingProfileId(null);
      addDocProfileRef.current = null;
      e.target.value = '';
    }
  };

  const displayProfiles = sortProfilesForDisplay(profiles);

  useEffect(() => {
    const loadDocumentsForSelected = async () => {
      if (!selectedProfileId) {
        setDocuments([]);
        return;
      }
      setDocumentsLoading(true);
      try {
        const accessToken = await requireAccessToken();
        const docs = await listDocuments(accessToken, selectedProfileId);
        setDocuments(docs);
      } catch (err) {
        reportError(err, 'Could not load documents.');
        setDocuments([]);
      } finally {
        setDocumentsLoading(false);
      }
    };
    void loadDocumentsForSelected();
  }, [reportError, selectedProfileId]);

  const selectProfile = (profile: ProfilePublic) => {
    setSelectedProfileId(profile.id);
    writeStoredSelectedProfileId(profile.id);
  };

  const handleAddProfile: SubmitHandler<ProfileNameFormValues> = async (
    values,
  ) => {
    setCreating(true);
    try {
      const accessToken = await requireAccessToken();
      const created = await createProfile(accessToken, {
        display_name: values.display_name.trim(),
      });
      await reloadProfiles(accessToken);
      selectProfile(created);
      reset({ display_name: '' });
      setShowAddForm(false);
    } catch (err) {
      reportError(err, 'Could not create profile.');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (profile: ProfilePublic) => {
    setShowAddForm(false);
    setEditingId(profile.id);
    resetRename({ display_name: profile.display_name });
  };

  const cancelRename = () => {
    setEditingId(null);
    resetRename({ display_name: '' });
  };

  const handleSaveRename =
    (profileId: string): SubmitHandler<ProfileNameFormValues> =>
    async (values) => {
      setSavingId(profileId);
      try {
        const accessToken = await requireAccessToken();
        await updateProfile(accessToken, profileId, {
          display_name: values.display_name.trim(),
        });
        await reloadProfiles(accessToken);
        cancelRename();
      } catch (err) {
        reportError(err, 'Could not rename profile.');
      } finally {
        setSavingId(null);
      }
    };

  const handleDeleteProfile = async (profile: ProfilePublic) => {
    if (profile.is_self) {
      return;
    }

    setDeletingId(profile.id);
    try {
      const accessToken = await requireAccessToken();
      await deleteProfile(accessToken, profile.id);
      if (editingId === profile.id) {
        cancelRename();
      }
      await reloadProfiles(accessToken);
    } catch (err) {
      reportError(err, 'Could not delete profile.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedProfileId) {
      return;
    }

    setDeletingDocumentId(documentId);
    try {
      const accessToken = await requireAccessToken();
      await deleteProfileDocument(accessToken, selectedProfileId, documentId);
      const docs = await listDocuments(accessToken, selectedProfileId);
      setDocuments(docs);
    } catch (err) {
      reportError(err, 'Could not delete document.');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf"
        multiple
        onChange={handleFilesSelected}
      />
      <CardHeader>
        <CardTitle>Profiles</CardTitle>
        <CardDescription>
          Select a profile for uploads and chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayProfiles.length > 0 ? (
          <ul className="space-y-1">
            {displayProfiles.map((profile) => (
              <li key={profile.id} className="flex items-center gap-2">
                {editingId === profile.id ? (
                  <form
                    className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
                    onSubmit={handleRenameSubmit(handleSaveRename(profile.id))}
                    noValidate
                  >
                    <Field
                      className="min-w-0 flex-1"
                      data-invalid={!!renameErrors.display_name}
                    >
                      <FieldLabel className="sr-only">Name</FieldLabel>
                      <FieldContent>
                        <Input
                          autoFocus
                          aria-invalid={!!renameErrors.display_name}
                          {...registerRename('display_name', DISPLAY_NAME_RULES)}
                        />
                      </FieldContent>
                      <FieldError errors={[renameErrors.display_name]} />
                    </Field>
                    <Button
                      type="submit"
                      size="xs"
                      disabled={savingId === profile.id}
                    >
                      {savingId === profile.id ? 'Saving…' : 'save'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={savingId === profile.id}
                      onClick={cancelRename}
                    >
                      cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${profileButtonClass(profile.id, selectedProfileId)} min-w-0 flex-1`}
                      onClick={() => selectProfile(profile)}
                    >
                      {profile.display_name}
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={uploadingProfileId === profile.id}
                      onClick={() => handleAddDocuments(profile.id)}
                    >
                      {uploadingProfileId === profile.id
                        ? 'Uploading…'
                        : 'Add document(s)'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => startRename(profile)}
                    >
                      rename
                    </Button>
                    {!profile.is_self ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={deletingId === profile.id}
                        onClick={() => void handleDeleteProfile(profile)}
                      >
                        {deletingId === profile.id ? 'Deleting…' : 'delete'}
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No profiles yet.
          </p>
        )}

        <div className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Selected profile documents
          </p>
          {!selectedProfileId ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a profile to view documents.
            </p>
          ) : null}
          {documentsLoading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
          ) : null}
          {!documentsLoading && selectedProfileId && documents.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No documents yet.
            </p>
          ) : null}
          {!documentsLoading && documents.length > 0 ? (
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
                        {doc.mime_type} · {formatBytes(doc.byte_size)}
                      </p>
                    </div>
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
          ) : null}
        </div>

        <div className="space-y-3 pt-1">
          {!showAddForm ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                cancelRename();
                setShowAddForm(true);
              }}
            >
              add profile
            </Button>
          ) : null}

          {showAddForm ? (
            <form
              key="add-profile-form"
              className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
              onSubmit={handleSubmit(handleAddProfile)}
              noValidate
            >
              <Field data-invalid={!!errors.display_name}>
                <FieldLabel>Name</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="Person name"
                    autoComplete="name"
                    {...register('display_name', DISPLAY_NAME_RULES)}
                    aria-invalid={!!errors.display_name}
                  />
                </FieldContent>
                <FieldError errors={[errors.display_name]} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Saving…' : 'Create profile'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={() => {
                    reset({ display_name: '' });
                    setShowAddForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
