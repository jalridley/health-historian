import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export function accountNameFromUser(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const firstName =
    typeof metadata?.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName =
    typeof metadata?.last_name === 'string' ? metadata.last_name.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }
  const emailLocal = user.email?.split('@')[0];
  return emailLocal || 'there';
}

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to read auth session: ${error.message}`);
  }

  return data.session?.access_token ?? null;
}
