/**
 * Local cost estimation for the user's own OpenAI key.
 *
 * These prices are an indicative local table, not a billing source of truth: OpenAI
 * can change them at any time, and regional taxes or tiered pricing are not modelled.
 * An unknown model returns `null` so the app never displays an invented amount.
 * The user is told to check https://openai.com/api/pricing/ for the authoritative
 * numbers.
 */
export type ModelPricing = { inputPerMillionUsd: number; outputPerMillionUsd: number };

export const PRICING_TABLE: Record<string, ModelPricing> = {
  'gpt-4.1-mini': { inputPerMillionUsd: 0.4, outputPerMillionUsd: 1.6 },
  'gpt-4.1': { inputPerMillionUsd: 2.0, outputPerMillionUsd: 8.0 },
  'gpt-5-mini': { inputPerMillionUsd: 0.25, outputPerMillionUsd: 2.0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const pricing = PRICING_TABLE[model];
  if (!pricing) return null;
  if (inputTokens === null && outputTokens === null) return null;
  const input = ((inputTokens ?? 0) / 1_000_000) * pricing.inputPerMillionUsd;
  const output = ((outputTokens ?? 0) / 1_000_000) * pricing.outputPerMillionUsd;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

export function formatUsd(value: number): string {
  if (value === 0) return '0,00 $';
  if (value < 0.01) return `${value.toFixed(4).replace('.', ',')} $`;
  return `${value.toFixed(2).replace('.', ',')} $`;
}
