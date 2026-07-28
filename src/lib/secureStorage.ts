import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * SecureStore-backed storage adapter for the Supabase auth session
 * (brief Section 6: persist via expo-secure-store).
 *
 * SecureStore rejects values larger than ~2KB, and a Supabase session (access
 * token + refresh token + user) can exceed that. We transparently chunk large
 * values across numbered keys and reassemble on read, so the whole session
 * still lives in the OS keychain/keystore.
 */

// Stay comfortably under SecureStore's 2048-byte ceiling.
const CHUNK_SIZE = 1800;
// Stored at the base key, tells us how many chunks to read back.
const COUNT_SUFFIX = '__chunks';

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function clearChunks(key: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  deletions.push(SecureStore.deleteItemAsync(`${key}${COUNT_SUFFIX}`));
  await Promise.all(deletions);
}

async function getChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}${COUNT_SUFFIX}`);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const secureStorage: SupportedStorage = {
  async getItem(key) {
    const count = await getChunkCount(key);
    if (count === 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(chunkKey(key, i)),
      ),
    );
    // If any chunk is missing the stored value is corrupt — treat as absent.
    if (parts.some((p) => p === null)) return null;
    return parts.join('');
  },

  async setItem(key, value) {
    const previousCount = await getChunkCount(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)),
    );
    await SecureStore.setItemAsync(`${key}${COUNT_SUFFIX}`, String(chunks.length));

    // Remove any now-orphaned chunks from a previously longer value.
    if (previousCount > chunks.length) {
      const stale: Promise<void>[] = [];
      for (let i = chunks.length; i < previousCount; i += 1) {
        stale.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
      }
      await Promise.all(stale);
    }
  },

  async removeItem(key) {
    const count = await getChunkCount(key);
    await clearChunks(key, count);
  },
};
