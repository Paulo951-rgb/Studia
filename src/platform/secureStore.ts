import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * All secrets live in the OS keychain/keystore through expo-secure-store.
 * Nothing secret is ever written to SQLite, to logs, or to the bundle.
 */
const KEYS = {
  dbKey: 'scolary.db.key',
  openaiKey: 'scolary.openai.key',
  pronoteToken: (accountId: string) => `scolary.pronote.token.${accountId}`,
  pronoteDevice: (accountId: string) => `scolary.pronote.device.${accountId}`,
  appLock: 'scolary.app.lock',
} as const;

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.dbKey, OPTIONS);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEYS.dbKey, key, OPTIONS);
  return key;
}

export async function getOpenAiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.openaiKey, OPTIONS);
}

export async function setOpenAiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Clé API vide');
  await SecureStore.setItemAsync(KEYS.openaiKey, trimmed, OPTIONS);
}

export async function deleteOpenAiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.openaiKey, OPTIONS);
}

export async function getPronoteToken(accountId: string): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.pronoteToken(accountId), OPTIONS);
}

export async function setPronoteToken(accountId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.pronoteToken(accountId), token, OPTIONS);
}

export async function deletePronoteToken(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.pronoteToken(accountId), OPTIONS);
}

export async function getDeviceUuid(accountId: string): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.pronoteDevice(accountId), OPTIONS);
  if (existing) return existing;
  const uuid = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEYS.pronoteDevice(accountId), uuid, OPTIONS);
  return uuid;
}

export async function deleteDeviceUuid(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.pronoteDevice(accountId), OPTIONS);
}

export async function setAppLock(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(KEYS.appLock, '1', OPTIONS);
  else await SecureStore.deleteItemAsync(KEYS.appLock, OPTIONS);
}

export async function isAppLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEYS.appLock, OPTIONS)) === '1';
}

export async function wipeAllSecrets(accountIds: string[]): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.dbKey, OPTIONS);
  await SecureStore.deleteItemAsync(KEYS.openaiKey, OPTIONS);
  for (const accountId of accountIds) {
    await SecureStore.deleteItemAsync(KEYS.pronoteToken(accountId), OPTIONS);
    await SecureStore.deleteItemAsync(KEYS.pronoteDevice(accountId), OPTIONS);
  }
}
