'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  sortProfilesForDisplay,
  updateProfile,
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

type ProfileListProps = {
  onError?: (message: string) => void;
};

export const ProfileList = ({ onError }: ProfileListProps) => {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfilePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const reportError = useCallback((err: unknown, fallback: string) => {
    const detail = err instanceof Error ? err.message : fallback;
    onErrorRef.current?.(detail);
  }, []);

  const reloadProfiles = useCallback(
    async (accessToken: string) => {
      const list = await listProfiles(accessToken);
      setProfiles(list);
    },
    [],
  );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setLoadError(error.message);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const session = data.session;
    if (!session?.access_token) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    try {
      const list = await ensureSelfProfile(session);
      setProfiles(list);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Could not load profiles.';
      setLoadError(detail);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const displayProfiles = sortProfilesForDisplay(profiles);

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
      reset({ display_name: '' });
      setShowAddForm(false);
      router.push(`/profiles/${created.id}/chat`);
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

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profiles</CardTitle>
        <CardDescription>
          Select a profile to open chat and documents.
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
                          {...registerRename(
                            'display_name',
                            DISPLAY_NAME_RULES,
                          )}
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
                    <Link
                      href={`/profiles/${profile.id}/chat`}
                      className="min-w-0 flex-1 rounded-md border border-transparent px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {profile.display_name}
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => startRename(profile)}
                    >
                      rename
                    </Button>
                    {/* TODO: confirm dialog before delete */}
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
};
