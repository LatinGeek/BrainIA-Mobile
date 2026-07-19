import { deleteStoredValue, readStoredValue, writeStoredValue } from './storage';

const STORAGE_PREFIX = 'brainia_mobile.cache';
const INDEX_KEY = `${STORAGE_PREFIX}.index`;

export type CacheEnvelope<T> = {
  savedAt: string;
  value: T;
};

async function readIndex(): Promise<string[]> {
  const raw = await readStoredValue(INDEX_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIndex(keys: string[]) {
  await writeStoredValue(INDEX_KEY, JSON.stringify(keys));
}

async function registerKey(key: string) {
  const keys = await readIndex();
  if (!keys.includes(key)) {
    keys.push(key);
    await writeIndex(keys);
  }
}

export async function readJsonCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const raw = await readStoredValue(`${STORAGE_PREFIX}.${key}`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (typeof parsed?.savedAt === 'string' && 'value' in parsed) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function writeJsonCache<T>(key: string, value: T) {
  await registerKey(key);
  await writeStoredValue(
    `${STORAGE_PREFIX}.${key}`,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      value,
    })
  );
}

export async function deleteJsonCache(key: string) {
  await deleteStoredValue(`${STORAGE_PREFIX}.${key}`);
}

export async function clearAllJsonCache() {
  const keys = await readIndex();
  await Promise.all(keys.map((key) => deleteJsonCache(key)));
  await deleteStoredValue(INDEX_KEY);
}
