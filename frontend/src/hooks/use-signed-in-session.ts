'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accountNameFromUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type SignedInSessionState = {
  accountName: string | null;
  ready: boolean;
};

export const useSignedInSession = (
  redirectToLoginWhenSignedOut = true,
): SignedInSessionState => {
  const router = useRouter();
  const [accountName, setAccountName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAccountName(null);
        setReady(true);
        if (redirectToLoginWhenSignedOut) {
          router.replace('/');
        }
        return;
      }

      const session = data.session;
      if (!session?.user) {
        setAccountName(null);
        setReady(true);
        if (redirectToLoginWhenSignedOut) {
          router.replace('/');
        }
        return;
      }

      setAccountName(accountNameFromUser(session.user));
      setReady(true);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAccountName(accountNameFromUser(session.user));
        setReady(true);
        return;
      }

      setAccountName(null);
      setReady(true);
      if (redirectToLoginWhenSignedOut) {
        router.replace('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [redirectToLoginWhenSignedOut, router]);

  return { accountName, ready };
};
