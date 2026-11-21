import type { SqlDatabase } from '@/db/driver';
import type { AiUsage, AiUsageSummary } from '@/core/domain/types';

export function createUsageRepo(db: SqlDatabase) {
  return {
    async record(entry: AiUsage): Promise<void> {
      await db.run(
        `INSERT OR REPLACE INTO ai_usage
          (id, account_id, conversation_id, model, input_tokens, output_tokens, estimated_cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.accountId,
          entry.conversationId,
          entry.model,
          entry.inputTokens,
          entry.outputTokens,
          entry.estimatedCostUsd,
          entry.createdAt,
        ],
      );
    },

    async summary(options: { accountId: string | null; since: string }): Promise<AiUsageSummary> {
      const rows = await db.all<{
        requests: number;
        input_tokens: number | null;
        output_tokens: number | null;
        cost: number | null;
        unknown_cost: number;
      }>(
        `SELECT
           COUNT(*) AS requests,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(estimated_cost_usd) AS cost,
           SUM(CASE WHEN estimated_cost_usd IS NULL THEN 1 ELSE 0 END) AS unknown_cost
         FROM ai_usage
         WHERE created_at >= ? AND (? IS NULL OR account_id = ?)`,
        [options.since, options.accountId, options.accountId],
      );
      const row = rows[0];
      return {
        requests: row?.requests ?? 0,
        inputTokens: row?.input_tokens ?? 0,
        outputTokens: row?.output_tokens ?? 0,
        estimatedCostUsd: Math.round((row?.cost ?? 0) * 1_000_000) / 1_000_000,
        unknownCostRequests: row?.unknown_cost ?? 0,
      };
    },

    async recent(limit = 20): Promise<AiUsage[]> {
      const rows = await db.all<{
        id: string;
        account_id: string | null;
        conversation_id: string | null;
        model: string;
        input_tokens: number | null;
        output_tokens: number | null;
        estimated_cost_usd: number | null;
        created_at: string;
      }>('SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT ?', [Math.min(Math.max(limit, 1), 100)]);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        conversationId: row.conversation_id,
        model: row.model,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        estimatedCostUsd: row.estimated_cost_usd,
        createdAt: row.created_at,
      }));
    },
  };
}

export type UsageRepo = ReturnType<typeof createUsageRepo>;
