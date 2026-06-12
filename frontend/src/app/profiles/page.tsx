'use client';

import { useCallback, useState } from 'react';
import { ProfileList } from './_components/profile-list';

export default function ProfilesPage() {
  const [message, setMessage] = useState<string | null>(null);

  const handleError = useCallback((detail: string) => {
    setMessage(detail);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ProfileList onError={handleError} />
      {message ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
      ) : null}
    </div>
  );
}
