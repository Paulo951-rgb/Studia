/**
 * Deterministic identifiers.
 *
 * IDs must be stable across syncs, devices and app restarts so that upserts never
 * duplicate rows. They are derived from the provider's native identifier, which is
 * the only stable key PRONOTE exposes.
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

export function makeId(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}_${fnv1a64(parts.join('|'))}`;
}

export function accountIdFor(provider: string, schoolUrl: string, username: string): string {
  return makeId('acc', provider, normalizeUrl(schoolUrl).toLowerCase(), username.trim().toLowerCase());
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Credentials are sent to this URL: plain HTTP is refused rather than upgraded silently,
  // so the user knows the address was wrong.
  if (/^http:\/\//i.test(trimmed)) {
    throw new Error('HTTPS requis : l’adresse de l’établissement doit commencer par https://');
  }
  const withScheme = /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

export function uuidFromSeed(seed: string): string {
  const hex = fnv1a64(seed) + fnv1a64(`salt:${seed}`);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export function newId(prefix: string, randomHex: string): string {
  return `${prefix}_${randomHex}`;
}
