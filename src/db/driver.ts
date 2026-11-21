/**
 * Minimal asynchronous SQL interface implemented by two drivers:
 * - `expoDriver` (expo-sqlite, SQLCipher build) on device;
 * - `nodeDriver` (node:sqlite) in tests.
 *
 * Keeping the surface this small is deliberate: everything above this layer is
 * plain TypeScript and can be tested against a real SQLite engine.
 */
export type SqlParam = string | number | null;

export type SqlResult = { changes: number };

export type SqlDatabase = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<SqlResult>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export class SqlError extends Error {
  readonly code: string;
  constructor(message: string, code = 'SQL_ERROR') {
    super(message);
    this.name = 'SqlError';
    this.code = code;
  }
}

export function toBoolean(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

export function fromBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function parseJsonArray<T>(raw: string | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonObject<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
