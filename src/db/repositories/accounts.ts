import type { SqlDatabase } from '@/db/driver';
import { upsert } from '@/db/upsert';
import { parseJsonObject } from '@/db/driver';
import type { Account, SessionRecord, SyncHistoryEntry, SyncRunKind } from '@/core/domain/types';

type AccountRow = {
  id: string;
  provider: string;
  display_name: string;
  school_url: string;
  account_kind: string;
  resource_id: string | null;
  student_name: string | null;
  class_name: string | null;
  establishment_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
};

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    provider: 'pronote',
    displayName: row.display_name,
    schoolUrl: row.school_url,
    accountKind: row.account_kind as Account['accountKind'],
    resourceId: row.resource_id,
    studentName: row.student_name,
    className: row.class_name,
    establishmentName: row.establishment_name,
    status: row.status as Account['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncAt: row.last_sync_at,
  };
}

export function createAccountsRepo(db: SqlDatabase) {
  return {
    async list(): Promise<Account[]> {
      const rows = await db.all<AccountRow>('SELECT * FROM accounts ORDER BY created_at');
      return rows.map(toAccount);
    },
    async get(id: string): Promise<Account | undefined> {
      const row = await db.get<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
      return row ? toAccount(row) : undefined;
    },
    async save(account: Account): Promise<void> {
      await upsert(db, 'accounts', {
        id: account.id,
        provider: account.provider,
        display_name: account.displayName,
        school_url: account.schoolUrl,
        account_kind: account.accountKind,
        resource_id: account.resourceId,
        student_name: account.studentName,
        class_name: account.className,
        establishment_name: account.establishmentName,
        status: account.status,
        created_at: account.createdAt,
        updated_at: account.updatedAt,
        last_sync_at: account.lastSyncAt,
      });
    },
    async setStatus(id: string, status: Account['status']): Promise<void> {
      await db.run('UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?', [
        status,
        new Date().toISOString(),
        id,
      ]);
    },
    async markSynced(id: string, at: string): Promise<void> {
      await db.run('UPDATE accounts SET last_sync_at = ?, updated_at = ? WHERE id = ?', [at, at, id]);
    },
    async remove(id: string): Promise<void> {
      // search_index has no foreign key: purge it explicitly so nothing is left behind.
      await db.run('DELETE FROM search_index WHERE account_id = ?', [id]);
      await db.run('DELETE FROM accounts WHERE id = ?', [id]);
    },
  };
}

type SessionRow = {
  id: string;
  account_id: string;
  device_uuid: string;
  secret_ref: string;
  navigator_identifier: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string | null;
  invalidated_at: string | null;
  invalid_reason: string | null;
};

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    deviceUuid: row.device_uuid,
    secretRef: row.secret_ref,
    navigatorIdentifier: row.navigator_identifier,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    invalidatedAt: row.invalidated_at,
    invalidReason: row.invalid_reason,
  };
}

export function createSessionsRepo(db: SqlDatabase) {
  return {
    async save(session: SessionRecord): Promise<void> {
      await upsert(db, 'sessions', {
        id: session.id,
        account_id: session.accountId,
        device_uuid: session.deviceUuid,
        secret_ref: session.secretRef,
        navigator_identifier: session.navigatorIdentifier,
        created_at: session.createdAt,
        last_used_at: session.lastUsedAt,
        expires_at: session.expiresAt,
        invalidated_at: session.invalidatedAt,
        invalid_reason: session.invalidReason,
      });
    },
    async getForAccount(accountId: string): Promise<SessionRecord | undefined> {
      const row = await db.get<SessionRow>(
        'SELECT * FROM sessions WHERE account_id = ? ORDER BY last_used_at DESC LIMIT 1',
        [accountId],
      );
      return row ? toSession(row) : undefined;
    },
    async touch(id: string): Promise<void> {
      await db.run('UPDATE sessions SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    },
    async invalidate(id: string, reason: string): Promise<void> {
      const now = new Date().toISOString();
      await db.run('UPDATE sessions SET invalidated_at = ?, invalid_reason = ? WHERE id = ?', [now, reason, id]);
    },
    async removeForAccount(accountId: string): Promise<void> {
      await db.run('DELETE FROM sessions WHERE account_id = ?', [accountId]);
    },
  };
}

export function createSyncRepo(db: SqlDatabase) {
  return {
    async startRun(entry: SyncHistoryEntry): Promise<void> {
      await upsert(db, 'sync_history', {
        id: entry.id,
        account_id: entry.accountId,
        kind: entry.kind,
        started_at: entry.startedAt,
        finished_at: entry.finishedAt,
        status: entry.status,
        resources_json: JSON.stringify(entry.resources),
        error_code: entry.errorCode,
        error_message: entry.errorMessage,
        duration_ms: entry.durationMs,
      });
    },
    async finishRun(entry: SyncHistoryEntry): Promise<void> {
      await this.startRun(entry);
    },
    async lastRun(accountId: string): Promise<SyncHistoryEntry | undefined> {
      const row = await db.get<{
        id: string;
        account_id: string;
        kind: string;
        started_at: string;
        finished_at: string | null;
        status: string;
        resources_json: string;
        error_code: string | null;
        error_message: string | null;
        duration_ms: number | null;
      }>('SELECT * FROM sync_history WHERE account_id = ? ORDER BY started_at DESC LIMIT 1', [accountId]);
      if (!row) return undefined;
      return {
        id: row.id,
        accountId: row.account_id,
        kind: row.kind as SyncRunKind,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status as SyncHistoryEntry['status'],
        resources: JSON.parse(row.resources_json) as SyncHistoryEntry['resources'],
        errorCode: row.error_code,
        errorMessage: row.error_message,
        durationMs: row.duration_ms,
      };
    },
    async listRuns(accountId: string, limit = 20): Promise<SyncHistoryEntry[]> {
      const rows = await db.all<{
        id: string;
        account_id: string;
        kind: string;
        started_at: string;
        finished_at: string | null;
        status: string;
        resources_json: string;
        error_code: string | null;
        error_message: string | null;
        duration_ms: number | null;
      }>(
        `SELECT id, account_id, kind, started_at, finished_at, status, resources_json,
                error_code, error_message, duration_ms
         FROM sync_history WHERE account_id = ? ORDER BY started_at DESC LIMIT ?`,
        [accountId, limit],
      );
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        kind: row.kind as SyncRunKind,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status as SyncHistoryEntry['status'],
        resources: parseJsonObject(row.resources_json, {} as SyncHistoryEntry['resources']),
        errorCode: row.error_code,
        errorMessage: row.error_message,
        durationMs: row.duration_ms,
      }));
    },
    async getCursor(accountId: string, resource: string): Promise<string | null> {
      const row = await db.get<{ cursor: string | null }>(
        'SELECT cursor FROM sync_state WHERE account_id = ? AND resource = ?',
        [accountId, resource],
      );
      return row?.cursor ?? null;
    },
    async setCursor(accountId: string, resource: string, cursor: string | null, error: string | null = null): Promise<void> {
      await db.run(
        `INSERT INTO sync_state (account_id, resource, cursor, last_synced_at, last_error)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id, resource) DO UPDATE SET
           cursor = excluded.cursor,
           last_synced_at = excluded.last_synced_at,
           last_error = excluded.last_error`,
        [accountId, resource, cursor, new Date().toISOString(), error],
      );
    },
    async getStates(accountId: string): Promise<{ resource: string; lastSyncedAt: string | null; lastError: string | null }[]> {
      return db.all(
        'SELECT resource, last_synced_at AS lastSyncedAt, last_error AS lastError FROM sync_state WHERE account_id = ?',
        [accountId],
      );
    },
  };
}
