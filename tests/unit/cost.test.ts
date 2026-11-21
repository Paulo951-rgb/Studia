import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCostUsd, formatUsd, PRICING_TABLE } from '@/core/ai/cost';

test('cost is computed from the local price table', () => {
  // gpt-4.1-mini: 0.40 $ / M input, 1.60 $ / M output
  assert.equal(estimateCostUsd('gpt-4.1-mini', 1_000_000, 0), 0.4);
  assert.equal(estimateCostUsd('gpt-4.1-mini', 0, 1_000_000), 1.6);
  assert.equal(estimateCostUsd('gpt-4.1-mini', 2_500, 1_000), 0.0026);
});

test('an unknown model or missing usage yields no invented amount', () => {
  assert.equal(estimateCostUsd('unknown-model', 1000, 1000), null);
  assert.equal(estimateCostUsd('gpt-4.1-mini', null, null), null);
  assert.ok(Object.keys(PRICING_TABLE).length > 0);
});

test('null tokens are treated as zero when the other side is known', () => {
  assert.equal(estimateCostUsd('gpt-4.1-mini', 1_000_000, null), 0.4);
});

test('USD formatting uses French separators', () => {
  assert.equal(formatUsd(0), '0,00 $');
  assert.equal(formatUsd(0.0026), '0,0026 $');
  assert.equal(formatUsd(1.5), '1,50 $');
});
