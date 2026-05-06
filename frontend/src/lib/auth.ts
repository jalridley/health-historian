import { supabase } from '@/lib/supabase';

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to read auth session: ${error.message}`);
  }

  return data.session?.access_token ?? null;
}
