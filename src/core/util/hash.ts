import { fnv1a64 } from '@/core/util/ids';

/**
 * Stable hash of a JSON-serialisable value: keys are sorted so the same content
 * always produces the same hash, which is what change detection relies on.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

export function contentHash(value: unknown): string {
  return fnv1a64(stableStringify(value));
}
