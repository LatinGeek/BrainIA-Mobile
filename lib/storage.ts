import * as SecureStore from 'expo-secure-store';
import { Alert, NativeModules, Platform } from 'react-native';

const webMemory = new Map<string, string>();
const SAFE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const recoveryRequired = new Set<string>();
const serializedWrites = new Map<string, Promise<void>>();
let recoveryAlertShown = false;
const credentialBridge = NativeModules.BrainIANotificationBridge as {
  getCredentialMigrationState?: (key: string) => Promise<{ legacyValue: string | null; hadSecureValue: boolean }>;
  clearLegacyCredential?: (key: string, expectedValue: string) => Promise<boolean>;
} | undefined;

function credentialName(key: string) {
  return key === 'brainia_mobile.apiKey' ? 'apiKey' : key === 'brainia_mobile.clientId' ? 'clientId' : null;
}

function requireCredentialRecovery(key: string) {
  recoveryRequired.add(key);
  if (!recoveryAlertShown) {
    recoveryAlertShown = true;
    Alert.alert('Vuelve a iniciar sesión', 'No pudimos recuperar tu conexión segura. Abre Ajustes > Avanzado y vuelve a ingresar tus credenciales. La captura necesita una conexión válida.');
  }
}

// Only an intentional edit may replace a credential that failed to decrypt.
export type CredentialRecoveryKey = 'apiKey' | 'clientId' | 'v2AccessToken';

export function allowCredentialRecovery(key: CredentialRecoveryKey) {
  recoveryRequired.delete(`brainia_mobile.${key}`);
}

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

  const credential = credentialName(storageKey);
  if (Platform.OS !== 'android' || !credential || !credentialBridge?.getCredentialMigrationState) {
    return SecureStore.getItemAsync(storageKey);
  }

  try {
    const migration = await credentialBridge.getCredentialMigrationState(credential);
    let value: string | null;
    let readFailed = false;
    try {
      value = await SecureStore.getItemAsync(storageKey);
    } catch {
      value = null;
      readFailed = true;
    }
    // The existing encrypted JS session wins over a stale native copy.
    // A native-only session is moved before the plaintext copy is removed.
    if (value === null && migration.legacyValue !== null) {
      value = migration.legacyValue;
    }
    if (value !== null) {
      // Rewrite older Expo envelopes to the installed AES format before the
      // native reader verifies them (including legacy hybrid envelopes).
      await SecureStore.setItemAsync(storageKey, value);
      await credentialBridge.clearLegacyCredential?.(credential, value);
    } else if (migration.hadSecureValue || readFailed) {
      requireCredentialRecovery(storageKey);
    }
    return value;
  } catch {
    requireCredentialRecovery(storageKey);
    return null;
  }
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

  const credential = credentialName(storageKey);
  const save = async () => {
    if (recoveryRequired.has(storageKey)) return;
    try {
      await SecureStore.setItemAsync(storageKey, value);
      if (Platform.OS === 'android' && credential) {
        await credentialBridge?.clearLegacyCredential?.(credential, value);
      }
    } catch {
      if (!credential) throw new Error('Could not save settings');
      requireCredentialRecovery(storageKey);
    }
  };
  if (Platform.OS !== 'android' || !credential) return save();
  return runSerialized(storageKey, save);
}

// Keep quick successive edits in order through write + native verification.
// An older write must not verify against (or overwrite) a newer value.
async function runSerialized(storageKey: string, save: () => Promise<void>) {
  const pending = (serializedWrites.get(storageKey) ?? Promise.resolve()).then(save);
  serializedWrites.set(storageKey, pending);
  try {
    await pending;
  } finally {
    if (serializedWrites.get(storageKey) === pending) serializedWrites.delete(storageKey);
  }
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

  await serializedWrites.get(storageKey);
  await SecureStore.deleteItemAsync(storageKey);
  // Delete legacy copies too, after a verified empty secure value, so they
  // cannot resurrect a signed-out session on the next launch.
  const credential = credentialName(storageKey);
  if (Platform.OS === 'android' && credential && credentialBridge?.clearLegacyCredential) {
    await SecureStore.setItemAsync(storageKey, '');
    await credentialBridge.clearLegacyCredential(credential, '');
    await SecureStore.deleteItemAsync(storageKey);
  }
}

/**
 * ---------------------------------
 * v2 device credential lifecycle (G-V2-AUTH)
 * ---------------------------------
 * The bearer token lives only in Keystore-backed SecureStore (Android/iOS) or
 * process memory (web). It is never written to SharedPreferences, AsyncStorage,
 * localStorage, backups, diagnostics or logs. Metadata (expiry, generation,
 * revocation marker) is stored beside it in the same encrypted store.
 */

export const V2_ACCESS_TOKEN_KEY = 'brainia_mobile.v2AccessToken';
const V2_CREDENTIAL_META_KEY = 'brainia_mobile.v2AccessTokenMeta';
const V2_CREDENTIAL_VERSION = 2;
const V2_TOKEN_MIN_LENGTH = 16;
const V2_TOKEN_MAX_LENGTH = 4096;

export type V2CredentialStatus = 'unconfigured' | 'active' | 'expired' | 'revoked' | 'recovery_required';

export type V2CredentialSnapshot = {
  status: V2CredentialStatus;
  generation: number;
  issuedAt: number | null;
  expiresAt: number | null;
  rotatedAt: number | null;
  revokedAt: number | null;
};

type V2CredentialMeta = {
  version: typeof V2_CREDENTIAL_VERSION;
  generation: number;
  issuedAt: number;
  expiresAt: number | null;
  rotatedAt: number | null;
  revokedAt: number | null;
};

export type V2CredentialEnrollment = {
  token: string;
  /** Epoch milliseconds or an ISO-8601 timestamp. Omit for a server-opaque token. */
  expiresAt?: number | string | null;
};

function emptySnapshot(status: V2CredentialStatus = 'unconfigured'): V2CredentialSnapshot {
  return { status, generation: 0, issuedAt: null, expiresAt: null, rotatedAt: null, revokedAt: null };
}

function snapshotFor(status: V2CredentialStatus, meta: V2CredentialMeta): V2CredentialSnapshot {
  return {
    status,
    generation: meta.generation,
    issuedAt: meta.issuedAt,
    expiresAt: meta.expiresAt,
    rotatedAt: meta.rotatedAt,
    revokedAt: meta.revokedAt,
  };
}

/** Bearer credentials are printable ASCII without whitespace; never log the value. */
export function isValidV2AccessToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= V2_TOKEN_MIN_LENGTH && value.length <= V2_TOKEN_MAX_LENGTH && /^[\x21-\x7E]+$/.test(value);
}

export function isV2CredentialExpired(expiresAt: number | null, now = Date.now()): boolean {
  return expiresAt !== null && Number.isFinite(expiresAt) && expiresAt <= now;
}

function assertV2AccessToken(value: unknown): string {
  if (!isValidV2AccessToken(value)) throw new Error('Invalid access token');
  return value;
}

function parseV2Expiry(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === '') return null;
  // Numeric input is epoch milliseconds. Accepting it as a string lets settings
  // paste `1767225600000` without guessing; ISO-8601 strings still use Date.parse.
  const parsed = typeof trimmed === 'number'
    ? trimmed
    : /^\d+$/.test(trimmed)
      ? Number(trimmed)
      : Date.parse(trimmed);
  if (!Number.isFinite(parsed)) throw new Error('Invalid access token expiry');
  return parsed;
}

function isWebPlatform() {
  return Platform.OS === 'web';
}

// Web has no Keystore and localStorage is plaintext, so the v2 credential is
// memory-only there: a reload requires re-authentication instead of persisting it.
async function readV2Raw(key: string): Promise<string | null> {
  if (isWebPlatform()) return webMemory.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function writeV2Raw(key: string, value: string): Promise<void> {
  if (isWebPlatform()) {
    webMemory.set(key, value);
    return;
  }
  // Device-only Keychain accessibility on iOS; Android storage is already
  // Keystore-encrypted and excluded from cloud/device-transfer backups.
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function deleteV2Raw(key: string): Promise<void> {
  if (isWebPlatform()) {
    webMemory.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function parseV2Meta(raw: string): V2CredentialMeta {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unreadable credential record');
  const record = value as Record<string, unknown>;
  if (record.version !== V2_CREDENTIAL_VERSION) throw new Error('Unsupported credential record version');
  const generation = record.generation;
  const issuedAt = record.issuedAt;
  const expiresAt = record.expiresAt;
  const rotatedAt = record.rotatedAt;
  const revokedAt = record.revokedAt;
  if (typeof generation !== 'number' || !Number.isFinite(generation) || generation < 1) throw new Error('Unreadable credential record');
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) throw new Error('Unreadable credential record');
  for (const value of [expiresAt, rotatedAt, revokedAt]) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Unreadable credential record');
  }
  return {
    version: V2_CREDENTIAL_VERSION,
    generation,
    issuedAt,
    expiresAt: expiresAt as number | null,
    rotatedAt: rotatedAt as number | null,
    revokedAt: revokedAt as number | null,
  };
}

async function readV2Meta(): Promise<V2CredentialMeta | null> {
  const raw = await readV2Raw(V2_CREDENTIAL_META_KEY);
  return raw === null ? null : parseV2Meta(raw);
}

async function writeV2Meta(meta: V2CredentialMeta): Promise<void> {
  await writeV2Raw(V2_CREDENTIAL_META_KEY, JSON.stringify(meta));
}

async function readV2TokenRaw(): Promise<string | null> {
  const token = await readV2Raw(V2_ACCESS_TOKEN_KEY);
  return token !== null && token.length > 0 ? token : null;
}

// A token written before this lifecycle existed is preserved, not downgraded:
// adopt it with neutral metadata instead of forcing a silent sign-out.
async function ensureV2CredentialMeta(): Promise<V2CredentialMeta | null> {
  const existing = await readV2Meta();
  if (existing) return existing;
  const token = await readV2TokenRaw();
  if (!token) return null;
  const adopted: V2CredentialMeta = {
    version: V2_CREDENTIAL_VERSION,
    generation: 1,
    issuedAt: Date.now(),
    expiresAt: null,
    rotatedAt: null,
    revokedAt: null,
  };
  await writeV2Meta(adopted);
  return adopted;
}

/** Resolves the token per request; returns null when missing, revoked, expired or unreadable. */
export async function readV2AccessToken(): Promise<string | null> {
  try {
    const meta = await ensureV2CredentialMeta();
    if (!meta || meta.revokedAt !== null) return null;
    if (isV2CredentialExpired(meta.expiresAt)) {
      requireCredentialRecovery(V2_ACCESS_TOKEN_KEY);
      return null;
    }
    const token = await readV2TokenRaw();
    if (!token) {
      requireCredentialRecovery(V2_ACCESS_TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    // Fail closed and ask for a visible re-authentication; never fall back to
    // legacy plaintext or an unauthenticated send.
    requireCredentialRecovery(V2_ACCESS_TOKEN_KEY);
    return null;
  }
}

/** Non-secret status for the settings screen. Never returns the token. */
export async function readV2Credential(): Promise<V2CredentialSnapshot> {
  try {
    const meta = await ensureV2CredentialMeta();
    if (!meta) return emptySnapshot();
    if (meta.revokedAt !== null) return snapshotFor('revoked', meta);
    if (isV2CredentialExpired(meta.expiresAt)) return snapshotFor('expired', meta);
    const token = await readV2TokenRaw();
    return token ? snapshotFor('active', meta) : snapshotFor('recovery_required', meta);
  } catch {
    return emptySnapshot('recovery_required');
  }
}

async function storeV2Credential(input: V2CredentialEnrollment, mode: 'enroll' | 'rotate'): Promise<V2CredentialSnapshot> {
  const token = assertV2AccessToken(input.token);
  const expiresAt = parseV2Expiry(input.expiresAt);
  if (expiresAt !== null && isV2CredentialExpired(expiresAt)) throw new Error('The access token is already expired');

  return runSerialized(V2_ACCESS_TOKEN_KEY, async () => {
    let previous: V2CredentialMeta | null = null;
    try {
      previous = await readV2Meta();
    } catch {
      // An explicit enrollment may replace an unreadable record.
      previous = null;
    }
    const now = Date.now();
    // Token first, then metadata: a crash can only leave the new token with an
    // older (failing) record, which fails closed to re-authentication.
    await writeV2Raw(V2_ACCESS_TOKEN_KEY, token);
    const meta: V2CredentialMeta = {
      version: V2_CREDENTIAL_VERSION,
      generation: (previous?.generation ?? 0) + 1,
      issuedAt: now,
      expiresAt,
      rotatedAt: mode === 'rotate' ? now : null,
      revokedAt: null,
    };
    await writeV2Meta(meta);
    recoveryRequired.delete(V2_ACCESS_TOKEN_KEY);
  }).then(async () => readV2Credential());
}

/** Explicit enrollment; the only path that provisions the v2 bearer token. */
export async function enrollV2AccessToken(input: V2CredentialEnrollment): Promise<V2CredentialSnapshot> {
  return storeV2Credential(input, 'enroll');
}

/** Replace the credential in place; the generation increases for auditability. */
export async function rotateV2AccessToken(input: V2CredentialEnrollment): Promise<V2CredentialSnapshot> {
  return storeV2Credential(input, 'rotate');
}

/** Revocation marks the record first so readers fail closed even if deletion fails. */
export async function revokeV2AccessToken(): Promise<V2CredentialSnapshot> {
  return runSerialized(V2_ACCESS_TOKEN_KEY, async () => {
    let meta: V2CredentialMeta | null = null;
    try {
      meta = await readV2Meta();
    } catch {
      meta = null;
    }
    if (!meta && !(await readV2TokenRaw())) return;
    const now = Date.now();
    await writeV2Meta({
      version: V2_CREDENTIAL_VERSION,
      generation: meta?.generation ?? 1,
      issuedAt: meta?.issuedAt ?? now,
      expiresAt: meta?.expiresAt ?? null,
      rotatedAt: meta?.rotatedAt ?? null,
      revokedAt: now,
    });
    await deleteV2Raw(V2_ACCESS_TOKEN_KEY);
  }).then(async () => readV2Credential());
}

/** Atomic sign-out: revoke the bearer token and drop it from secure storage. */
export async function logoutV2Session(): Promise<V2CredentialSnapshot> {
  return revokeV2AccessToken();
}
