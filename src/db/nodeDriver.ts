import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlParam, SqlResult } from '@/db/driver';

/**
 * Test driver: the same SQL runs against the real SQLite engine bundled with Node
 * (3.53.x at the time of writing), including FTS5.
 */
export function createNodeDatabase(location = ':memory:'): SqlDatabase {
  const db = new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  let depth = 0;

  const normalize = (params: SqlParam[] = []) =>
    params.map((value) => (value === undefined ? null : value)) as (string | number | null)[];

  return {
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
    async run(sql: string, params: SqlParam[] = []): Promise<SqlResult> {
      const result = db.prepare(sql).run(...normalize(params));
      return { changes: Number(result.changes) };
    },
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...normalize(params)) as T[];
    },
    async get<T>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
      return db.prepare(sql).get(...normalize(params)) as T | undefined;
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      depth += 1;
      if (depth === 1) db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        depth -= 1;
        if (depth === 0) db.exec('COMMIT');
        return result;
      } catch (error) {
        depth -= 1;
        if (depth === 0) db.exec('ROLLBACK');
        throw error;
      }
    },
    async close(): Promise<void> {
      db.close();
    },
  };
}
