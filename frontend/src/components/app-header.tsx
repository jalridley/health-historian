'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  accountName: string | null;
  onSignOut: () => void;
  signingOut: boolean;
};

export const AppHeader = ({
  accountName,
  onSignOut,
  signingOut,
}: AppHeaderProps) => {
  return (
    <header className="mb-4 flex items-center justify-between gap-4">
      <Link href="/profiles" className="text-2xl font-bold">
        HealthHistorian
      </Link>
      {accountName ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {accountName}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onSignOut}
            disabled={signingOut}
          >
            Log out
          </Button>
        </div>
      ) : null}
    </header>
  );
};
