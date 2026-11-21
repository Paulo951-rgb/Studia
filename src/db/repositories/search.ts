import type { SqlDatabase } from '@/db/driver';
import type { SearchHit } from '@/core/domain/types';
import { buildMatchExpression, likePattern } from '@/core/search/query';

export type SearchKind =
  | 'message'
  | 'document'
  | 'homework'
  | 'grade_comment'
  | 'news'
  | 'evaluation'
  | 'report_card'
  | 'chat_message'
  | 'memory'
  | 'event';

export function createSearchRepo(db: SqlDatabase) {
  return {
    async index(entry: {
      kind: SearchKind;
      refId: string;
      accountId: string;
      title: string;
      body: string;
    }): Promise<void> {
      await db.run('DELETE FROM search_index WHERE kind = ? AND ref_id = ?', [entry.kind, entry.refId]);
      if (!entry.body.trim() && !entry.title.trim()) return;
      await db.run(
        'INSERT INTO search_index (kind, ref_id, account_id, title, body) VALUES (?, ?, ?, ?, ?)',
        [entry.kind, entry.refId, entry.accountId, entry.title, entry.body],
      );
    },
    async remove(kind: SearchKind, refId: string): Promise<void> {
      await db.run('DELETE FROM search_index WHERE kind = ? AND ref_id = ?', [kind, refId]);
    },
    async removeByRef(refId: string): Promise<void> {
      await db.run('DELETE FROM search_index WHERE ref_id = ?', [refId]);
    },
    async search(options: {
      query: string;
      accountId: string;
      kinds?: SearchKind[];
      limit?: number;
      offset?: number;
    }): Promise<SearchHit[]> {
      const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
      const offset = Math.max(options.offset ?? 0, 0);
      const match = buildMatchExpression(options.query);
      if (!match) return [];

      const params: (string | number)[] = [match, options.accountId];
      let kindFilter = '';
      if (options.kinds && options.kinds.length > 0) {
        kindFilter = ` AND kind IN (${options.kinds.map(() => '?').join(', ')})`;
        params.push(...options.kinds);
      }
      params.push(limit, offset);

      const rows = await db.all<{
        kind: string;
        ref_id: string;
        title: string;
        snippet: string;
        score: number;
      }>(
        `SELECT kind,
                ref_id,
                title,
                snippet(search_index, 4, '[', ']', '…', 18) AS snippet,
                bm25(search_index) AS score
         FROM search_index
         WHERE search_index MATCH ? AND account_id = ?${kindFilter}
         ORDER BY score
         LIMIT ? OFFSET ?`,
        params,
      );

      return rows.map((row) => ({
        kind: row.kind,
        refId: row.ref_id,
        title: row.title,
        snippet: row.snippet,
        score: row.score,
      }));
    },
    async searchLoose(options: { query: string; accountId: string; limit?: number }): Promise<SearchHit[]> {
      const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
      const pattern = likePattern(options.query);
      const rows = await db.all<{ kind: string; ref_id: string; title: string; body: string }>(
        `SELECT kind, ref_id, title, body FROM search_index
         WHERE account_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
         LIMIT ?`,
        [options.accountId, pattern, pattern, limit],
      );
      return rows.map((row) => ({
        kind: row.kind,
        refId: row.ref_id,
        title: row.title,
        snippet: row.body.slice(0, 240),
        score: 0,
      }));
    },
  };
}
