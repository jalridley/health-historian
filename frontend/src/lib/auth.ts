import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const ALREADY_EXISTS_MESSAGE =
  'An account with this email already exists. Please log in.';

/** Header greeting: first + last from auth user_metadata. */
export function fullNameFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) {
    return null;
  }
  const firstName =
    typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName =
    typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || null;
}

export function accountNameFromUser(user: User): string {
  const fullName = fullNameFromMetadata(
    user.user_metadata as Record<string, unknown> | undefined,
  );
  if (fullName) {
    return fullName;
  }
  const emailLocal = user.email?.split('@')[0];
  return emailLocal || 'there';
}

export async function requireAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session?.access_token) {
    throw new Error('Not signed in.');
  }
  return data.session.access_token;
}

/** Supabase duplicate signup: explicit error or user with no session and no identities. */
export function isDuplicateSignup(
  error: { message: string } | null,
  user: { identities?: { id: string }[] } | null,
  session: unknown,
): boolean {
  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('already registered') ||
      message.includes('user already exists')
    ) {
      return true;
    }
  }
  return Boolean(user && !session && (user.identities?.length ?? 0) === 0);
}

export const DUPLICATE_SIGNUP_MESSAGE = ALREADY_EXISTS_MESSAGE;
