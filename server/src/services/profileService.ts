import { query } from '../config/database.js';

export interface Profile {
  wallet_address: string;
  role: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
}

export async function getProfile(wallet: string): Promise<Profile | null> {
  const result = await query<Profile>(
    `SELECT wallet_address, role, display_name, bio, avatar_url
     FROM profiles WHERE wallet_address = $1`,
    [wallet.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

export async function createProfile(data: {
  wallet_address: string;
  role: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
}): Promise<Profile> {
  const result = await query<Profile>(
    `INSERT INTO profiles (wallet_address, role, display_name, bio, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING wallet_address, role, display_name, bio, avatar_url`,
    [
      data.wallet_address.toLowerCase(),
      data.role,
      data.display_name,
      data.bio ?? null,
      data.avatar_url ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function updateProfile(
  wallet: string,
  data: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url'>>,
): Promise<Profile | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.display_name !== undefined) {
    sets.push(`display_name = $${idx++}`);
    values.push(data.display_name);
  }
  if (data.bio !== undefined) {
    sets.push(`bio = $${idx++}`);
    values.push(data.bio);
  }
  if (data.avatar_url !== undefined) {
    sets.push(`avatar_url = $${idx++}`);
    values.push(data.avatar_url);
  }

  if (sets.length === 0) return getProfile(wallet);

  values.push(wallet.toLowerCase());
  const result = await query<Profile>(
    `UPDATE profiles SET ${sets.join(', ')}, updated_at = now()
     WHERE wallet_address = $${idx}
     RETURNING wallet_address, role, display_name, bio, avatar_url`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function registerLocation(data: {
  wallet_address: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  is_public: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO locations (wallet_address, latitude, longitude, city, country, is_public)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (wallet_address)
     DO UPDATE SET latitude = $2, longitude = $3, city = $4, country = $5,
                   is_public = $6, updated_at = now()`,
    [
      data.wallet_address.toLowerCase(),
      data.latitude,
      data.longitude,
      data.city,
      data.country,
      data.is_public,
    ],
  );
}

export async function updateLocationVisibility(
  wallet: string,
  isPublic: boolean,
): Promise<void> {
  await query(
    `UPDATE locations SET is_public = $1, updated_at = now()
     WHERE wallet_address = $2`,
    [isPublic, wallet.toLowerCase()],
  );
}
