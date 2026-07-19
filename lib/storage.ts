import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const webMemory = new Map<string, string>();
const SAFE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

function hashKey(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeStorageKey(key: string) {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return `brainia_mobile.k_${hashKey(key)}`;
  }

  if (SAFE_KEY_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return `brainia_mobile.k_${hashKey(trimmed)}`;
}

export async function readStoredValue(key: string): Promise<string | null> {
  const storageKey = normalizeStorageKey(key);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return webMemory.get(storageKey) ?? null;
    }

    return window.localStorage.getItem(storageKey) ?? webMemory.get(storageKey) ?? null;
  }

  return SecureStore.getItemAsync(storageKey);
}

export async function writeStoredValue(key: string, value: string): Promise<void> {
  const storageKey = normalizeStorageKey(key);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      webMemory.set(storageKey, value);
      return;
    }

    window.localStorage.setItem(storageKey, value);
    webMemory.set(storageKey, value);
    return;
  }

  await SecureStore.setItemAsync(storageKey, value);
}

export async function deleteStoredValue(key: string): Promise<void> {
  const storageKey = normalizeStorageKey(key);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    webMemory.delete(storageKey);
    return;
  }

  await SecureStore.deleteItemAsync(storageKey);
}
