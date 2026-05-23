'use client';

import { useCallback, useEffect, useState } from 'react';
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
  deleteProfile,
  ensureSelfProfile,
  listProfiles,
  readStoredSelectedProfileId,
  resolveSelectedProfile,
  sortProfilesForDisplay,
  updateProfile,
  writeStoredSelectedProfileId,
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

function profileButtonClass(profileId: string, selectedProfileId: string | null) {
  const selected = selectedProfileId === profileId;
  return selected
    ? 'w-full rounded-md border border-zinc-900 bg-zinc-100 px-3 py-2 text-left text-sm font-medium dark:border-zinc-100 dark:bg-zinc-800'
    : 'w-full rounded-md border border-transparent px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800';
}

export function ProfilesPanel({ onError }: ProfilesPanelProps) {
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

  const displayProfiles = sortProfilesForDisplay(profiles);

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
}
