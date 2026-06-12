'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { useSignedInSession } from '@/hooks/use-signed-in-session';
import { clearStoredProfileSelection } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function ProfilesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { accountName, ready } = useSignedInSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    const { error } = await supabase.auth.signOut();
    clearStoredProfileSelection();
    setSigningOut(false);
    if (error) {
      setSignOutError(error.message);
      return;
    }
    router.replace('/');
  }, [router]);

  if (!ready) {
    return (
      <div className="p-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!accountName) {
    return (
      <div className="p-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Redirecting to log in…
        </p>
      </div>
    );
  }

  return (
    <div className="p-10">
      <AppHeader
        accountName={accountName}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />
      {signOutError ? (
        <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">
          {signOutError}
        </p>
      ) : null}
      {children}
    </div>
  );
}
