'use client';

import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { DocumentsList } from './_components/documents-list';

export default function DocumentsPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const [message, setMessage] = useState<string | null>(null);

  const handleError = useCallback((detail: string) => {
    setMessage(detail);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <DocumentsList profileId={profileId} onError={handleError} />
      {message ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>
      ) : null}
    </div>
  );
}
