import type { Repositories } from '@/db';
import type { Account, SessionRecord } from '@/core/domain/types';
import { accountIdFor, makeId, normalizeUrl } from '@/core/util/ids';
import { mapPronoteError } from '@/core/pronote/errors';
import { runSync, type SyncSummary } from '@/core/sync/engine';
import {
  deletePronoteToken,
  deleteDeviceUuid,
  getDeviceUuid,
  getPronoteToken,
  setPronoteToken,
} from '@/platform/secureStore';
import { PronoteSource, login, type LoginInput } from '@/providers/pronote/source';

export type ConnectInput =
  | { method: 'password'; url: string; username: string; password: string; kind: 'student' | 'parent' }
  | { method: 'qr'; qr: { url: string; kind: number; username: string; token: string }; pin: string };

export type ConnectResult = {
  accountId: string;
  account: Account;
  source: PronoteSource;
};

function secretRefFor(accountId: string): string {
  return `studia.pronote.token.${accountId}`;
}

/**
 * Opens a PRONOTE session, stores the *token* (never the password) in the keychain,
 * and records the account locally.
 */
export async function connectPronote(repos: Repositories, input: ConnectInput): Promise<ConnectResult> {
  const url = normalizeUrl(input.method === 'password' ? input.url : input.qr.url);
  const username = input.method === 'password' ? input.username : input.qr.username;
  const accountId = accountIdFor('pronote', url, username);
  const deviceUuid = await getDeviceUuid(accountId);

  const loginInput: LoginInput =
    input.method === 'password'
      ? { method: 'password', url, username, password: input.password, kind: input.kind, deviceUuid }
      : { method: 'qr', qr: { ...input.qr, url }, pin: input.pin, deviceUuid };

  const result = await login(loginInput);
  await setPronoteToken(accountId, result.token);

  const at = new Date().toISOString();
  const account: Account = {
    id: accountId,
    provider: 'pronote',
    displayName: result.session.user?.name ?? username,
    schoolUrl: url,
    accountKind: result.accountKind,
    resourceId: result.session.userResource?.id ?? null,
    studentName: result.session.user?.name ?? null,
    className: result.session.userResource?.className ?? null,
    establishmentName: result.session.userResource?.establishmentName ?? null,
    status: 'active',
    createdAt: at,
    updatedAt: at,
    lastSyncAt: null,
  };
  await repos.accounts.save(account);

  const session: SessionRecord = {
    id: makeId('ses', accountId, deviceUuid),
    accountId,
    deviceUuid,
    secretRef: secretRefFor(accountId),
    navigatorIdentifier: result.navigatorIdentifier,
    createdAt: at,
    lastUsedAt: at,
    expiresAt: null,
    invalidatedAt: null,
    invalidReason: null,
  };
  await repos.sessions.save(session);

  const source = new PronoteSource(result.session, accountId);
  await repos.writer.saveProfile(await source.fetchProfile());

  return { accountId, account, source };
}

/**
 * Re-opens a session from the stored token.
 *
 * PRONOTE tokens are single-use: a successful login returns a new token, which
 * immediately replaces the previous one. Two concurrent logins with the same token
 * would make the second fail, so callers must serialise renewals (see `syncAccount`).
 */
export async function resumePronoteSession(
  repos: Repositories,
  accountId: string,
): Promise<{ source: PronoteSource; deviceUuid: string }> {
  const account = await repos.accounts.get(accountId);
  if (!account) throw new Error('Compte local introuvable');
  const token = await getPronoteToken(accountId);
  if (!token) {
    const error = new Error('Aucun jeton PRONOTE enregistré : reconnexion nécessaire.');
    error.name = 'SessionExpiredError';
    throw error;
  }
  const deviceUuid = await getDeviceUuid(accountId);
  const result = await login({
    method: 'token',
    url: account.schoolUrl,
    username: account.studentName ?? account.displayName,
    token,
    kind: account.accountKind,
    deviceUuid,
  });
  await setPronoteToken(accountId, result.token);
  const session = await repos.sessions.getForAccount(accountId);
  if (session) await repos.sessions.touch(session.id);

  return { source: new PronoteSource(result.session, accountId), deviceUuid };
}

const inFlight = new Map<string, Promise<{ source: PronoteSource; deviceUuid: string }>>();

export function resumePronoteSessionOnce(repos: Repositories, accountId: string) {
  const existing = inFlight.get(accountId);
  if (existing) return existing;
  const promise = resumePronoteSession(repos, accountId).finally(() => {
    inFlight.delete(accountId);
  });
  inFlight.set(accountId, promise);
  return promise;
}

export type SyncAccountOptions = {
  kind: 'initial' | 'incremental' | 'manual' | 'background';
  signal?: AbortSignal;
  onProgress?: Parameters<typeof runSync>[0]['onProgress'];
  only?: Parameters<typeof runSync>[0]['only'];
};

export async function syncAccount(
  repos: Repositories,
  accountId: string,
  options: SyncAccountOptions,
): Promise<SyncSummary> {
  try {
    const { source } = await resumePronoteSessionOnce(repos, accountId);
    const summary = await runSync({
      repos,
      source,
      accountId,
      kind: options.kind,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      ...(options.only ? { only: options.only } : {}),
    });
    if (summary.requiresReauth) {
      await repos.accounts.setStatus(accountId, 'expired');
    }
    return summary;
  } catch (error) {
    const mapped = mapPronoteError(error);
    if (mapped.requiresReauth) await repos.accounts.setStatus(accountId, 'expired');
    const now = new Date().toISOString();
    return {
      runId: makeId('sync', accountId, now),
      kind: options.kind,
      status: 'error',
      startedAt: now,
      finishedAt: now,
      resources: {},
      requests: 0,
      errorCode: mapped.code,
      errorMessage: error instanceof Error ? error.message : mapped.message,
      requiresReauth: mapped.requiresReauth,
    };
  }
}

export async function disconnectAccount(repos: Repositories, accountId: string): Promise<void> {
  await deletePronoteToken(accountId);
  await deleteDeviceUuid(accountId);
  await repos.sessions.removeForAccount(accountId);
  await repos.accounts.remove(accountId);
}

export type ParsedQrPayload = { url: string; kind: number; username: string; token: string };

/**
 * PRONOTE's mobile QR code carries a JSON payload with the school URL, the account
 * kind and the encrypted credentials that the 4-digit PIN unlocks. We only validate
 * the shape; we never fabricate or decrypt anything ourselves.
 */
export function parseQrPayload(raw: string): ParsedQrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Ce QR code n'est pas un QR code PRONOTE lisible (JSON attendu).");
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('QR code PRONOTE invalide.');
  }
  const candidate = parsed as Record<string, unknown>;
  const url = typeof candidate['url'] === 'string' ? candidate['url'] : null;
  const kind = typeof candidate['kind'] === 'number' ? candidate['kind'] : null;
  const username = typeof candidate['username'] === 'string' ? candidate['username'] : null;
  const token = typeof candidate['token'] === 'string' ? candidate['token'] : null;
  if (!url || kind === null || !username || !token) {
    throw new Error("QR code PRONOTE incomplet : url, kind, username et token sont requis.");
  }
  return { url, kind, username, token };
}
