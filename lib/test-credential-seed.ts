import { enrollV2AccessToken, readV2Credential } from './storage';

/**
 * Test-build credential seed.
 *
 * When a build sets EXPO_PUBLIC_BRAINIA_TEST_TOKEN (e.g. in a gitignored
 * .env.local), the token is enrolled into the device's Keystore-backed store the
 * first time the app starts with no credential. Later launches do nothing, so a
 * user who logs out or revokes keeps that choice.
 *
 * The value is inlined into the JS bundle at build time. Use it only for personal
 * test builds on your own device, never for store, shared or CI-published builds.
 */
export async function seedTestCredential(): Promise<void> {
  const token = process.env.EXPO_PUBLIC_BRAINIA_TEST_TOKEN?.trim();
  if (!token) return;

  const current = await readV2Credential();
  if (current.status !== 'unconfigured') return;

  await enrollV2AccessToken({ token });
}
