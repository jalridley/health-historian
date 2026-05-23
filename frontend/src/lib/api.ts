import type { Session } from '@supabase/supabase-js';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

const SELECTED_PROFILE_STORAGE_KEY = 'health-historian-selected-profile-id';

export type ProfileCreatePayload = {
  display_name: string;
  is_self?: boolean;
  dob?: string;
};

export type ProfilePublic = {
  id: string;
  display_name: string;
  is_self: boolean;
  dob: string | null;
  created_at: string;
};

type ProfileUpdatePayload = {
  display_name: string;
};

async function profileRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status}).`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Self profile row in public.profiles: first name only (from auth user_metadata). */
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

export function clearStoredProfileSelection(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(SELECTED_PROFILE_STORAGE_KEY);
}

export async function listProfiles(
  accessToken: string,
): Promise<ProfilePublic[]> {
  return profileRequest<ProfilePublic[]>(accessToken, '/profiles', {
    method: 'GET',
  });
}

export function selfProfileFromList(
  profiles: ProfilePublic[],
): ProfilePublic | null {
  return profiles.find((profile) => profile.is_self) ?? null;
}

/** Self profile first, then other profiles sorted by name. */
export function sortProfilesForDisplay(
  profiles: ProfilePublic[],
): ProfilePublic[] {
  const self = selfProfileFromList(profiles);
  const others = profiles
    .filter((profile) => !profile.is_self)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  return self ? [self, ...others] : others;
}

export function readStoredSelectedProfileId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY);
}

export function writeStoredSelectedProfileId(profileId: string): void {
  localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profileId);
}

export function resolveSelectedProfile(
  profiles: ProfilePublic[],
  storedId: string | null,
): ProfilePublic | null {
  if (profiles.length === 0) {
    return null;
  }
  if (storedId) {
    const match = profiles.find((profile) => profile.id === storedId);
    if (match) {
      return match;
    }
  }
  return selfProfileFromList(profiles) ?? profiles[0];
}

export async function createProfile(
  accessToken: string,
  body: ProfileCreatePayload,
): Promise<ProfilePublic> {
  return profileRequest<ProfilePublic>(accessToken, '/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateProfile(
  accessToken: string,
  profileId: string,
  body: ProfileUpdatePayload,
): Promise<ProfilePublic> {
  return profileRequest<ProfilePublic>(accessToken, `/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteProfile(
  accessToken: string,
  profileId: string,
): Promise<void> {
  await profileRequest<void>(accessToken, `/profiles/${profileId}`, {
    method: 'DELETE',
  });
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
    is_self: true,
  });
  return [...profiles, created];
}
