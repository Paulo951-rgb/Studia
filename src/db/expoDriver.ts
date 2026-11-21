import * as SQLite from 'expo-sqlite';
import type { SqlDatabase, SqlParam, SqlResult } from '@/db/driver';

export type ExpoDatabaseOptions = {
  name: string;
  /** Database key. Required: the app refuses to write unencrypted school data. */
  key: string;
};

export class EncryptionUnavailableError extends Error {
  readonly code = 'ENCRYPTION_UNAVAILABLE';
  constructor() {
    super(
      "SQLCipher n'est pas disponible dans cette compilation : la base serait écrite en clair. " +
        'Compilez un development build avec le plugin expo-sqlite (useSQLCipher: true) puis réessayez.',
    );
    this.name = 'EncryptionUnavailableError';
  }
}

async function applyKey(db: SQLite.SQLiteDatabase, key: string): Promise<void> {
  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {
    throw new EncryptionUnavailableError();
  }
  // PRAGMA does not accept bound parameters; the key is hex from expo-crypto.
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error('Invalid database key format');
  }
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  // Touch the schema: with a wrong key this throws "file is not a database".
  await db.getFirstAsync('SELECT count(*) as c FROM sqlite_master');
  await db.execAsync('PRAGMA cipher_memory_security = ON;');
}

export async function openExpoDatabase({ name, key }: ExpoDatabaseOptions): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync(name);
  await applyKey(db, key);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA busy_timeout = 5000');

  return {
    async exec(sql: string): Promise<void> {
      await db.execAsync(sql);
    },
    async run(sql: string, params: SqlParam[] = []): Promise<SqlResult> {
      const result = await db.runAsync(sql, params);
      return { changes: result.changes };
    },
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.getAllAsync<T>(sql, params);
    },
    async get<T>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
      const row = await db.getFirstAsync<T>(sql, params);
      return row ?? undefined;
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      let result: T | undefined;
      let failure: unknown;
      await db.withTransactionAsync(async () => {
        try {
          result = await fn();
        } catch (error) {
          failure = error;
          throw error;
        }
      });
      if (failure) throw failure;
      return result as T;
    },
    async close(): Promise<void> {
      await db.closeAsync();
    },
  };
}

export async function isEncryptionAvailable(): Promise<boolean> {
  const db = await SQLite.openDatabaseAsync('scolary-probe');
  try {
    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    return Boolean(cipher?.cipher_version);
  } finally {
    await db.closeAsync();
  }
}
