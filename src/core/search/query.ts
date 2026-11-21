/**
 * FTS5 query construction.
 *
 * User input is never concatenated into a MATCH expression as-is: FTS5 has its own
 * operators (`AND`, `OR`, `NOT`, `NEAR`, `^`, `*`, `:`), and a raw string can either
 * fail with a syntax error or escape the intended scope. Every token is quoted and
 * operators are dropped, so the query can only match text.
 */

const MAX_TERMS = 12;

export function tokenizeQuery(raw: string): string[] {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2)
    .slice(0, MAX_TERMS);
}

export function buildMatchExpression(raw: string, options: { prefix?: boolean } = {}): string | null {
  const terms = tokenizeQuery(raw);
  if (terms.length === 0) return null;
  const quoted = terms.map((term) => `"${term.replace(/"/g, '""')}"`);
  if (options.prefix !== false) {
    const last = quoted[quoted.length - 1] ?? '';
    quoted[quoted.length - 1] = `${last}*`;
  }
  return quoted.join(' AND ');
}

/** Escapes a value used with LIKE, so `%` and `_` in user input stay literal. */
export function likePattern(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
