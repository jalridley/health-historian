import type { Session } from '@supabase/supabase-js';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export type ProfileCreatePayload = {
  display_name: string;
  relationship: string;
  dob?: string;
};

export type ProfilePublic = {
  id: string;
  display_name: string;
  relationship: string;
  dob: string | null;
  created_at: string;
};

export function displayNameFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) {
    return null;
  }
  const first =
    typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  return first || null;
}

export async function listProfiles(
  accessToken: string,
): Promise<ProfilePublic[]> {
  const response = await fetch(`${API_URL}/profiles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Failed to list profiles (${response.status}).`,
    );
  }

  return (await response.json()) as ProfilePublic[];
}

export function selfProfileFromList(
  profiles: ProfilePublic[],
): ProfilePublic | null {
  return profiles.find((profile) => profile.relationship === 'self') ?? null;
}

export async function createProfile(
  accessToken: string,
  body: ProfileCreatePayload,
): Promise<ProfilePublic> {
  const response = await fetch(`${API_URL}/profiles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Failed to create profile (${response.status}).`,
    );
  }

  return (await response.json()) as ProfilePublic;
}

/** Ensure a self profile exists; returns the user's profiles (one GET, optional POST). */
export async function ensureSelfProfile(
  session: Session,
): Promise<ProfilePublic[]> {
  const accessToken = session.access_token;
  if (!accessToken) {
    return [];
  }

  const profiles = await listProfiles(accessToken);
  if (selfProfileFromList(profiles)) {
    return profiles;
  }

  const displayName = displayNameFromMetadata(
    session.user.user_metadata as Record<string, unknown>,
  );
  if (!displayName) {
    return profiles;
  }

  const created = await createProfile(accessToken, {
    display_name: displayName,
    relationship: 'self',
  });
  return [...profiles, created];
}
