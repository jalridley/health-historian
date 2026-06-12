'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProfile, type ProfilePublic } from '@/lib/api';
import { requireAccessToken } from '@/lib/auth';

export default function ProfileChatPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const accessToken = await requireAccessToken();
      const result = await getProfile(accessToken, profileId);
      setProfile(result);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Could not load profile.';
      setLoadError(detail);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
    );
  }

  if (loadError) {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Chat</h1>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="xs" asChild>
              <Link href={`/profiles/${profileId}/documents`}>Documents</Link>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {profile ? `${profile.display_name} — Chat` : 'Chat'}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" asChild>
            <Link href={`/profiles/${profileId}/documents`}>Documents</Link>
          </Button>
          <Button type="button" variant="outline" size="xs" asChild>
            <Link href="/profiles">All profiles</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Chat coming soon.
      </p>
    </section>
  );
}
