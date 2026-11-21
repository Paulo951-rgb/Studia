import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAiGate } from '@/core/ai/gate';

test('the gate blocks the turn when consent is missing', () => {
  assert.equal(checkAiGate({ hasConsent: false, hasApiKey: true }), 'consent_required');
});

test('the gate blocks the turn when no API key is stored', () => {
  assert.equal(checkAiGate({ hasConsent: true, hasApiKey: false }), 'missing_api_key');
});

test('consent is reported before the missing key', () => {
  assert.equal(checkAiGate({ hasConsent: false, hasApiKey: false }), 'consent_required');
});

test('the gate opens only when consent and key are both present', () => {
  assert.equal(checkAiGate({ hasConsent: true, hasApiKey: true }), null);
});
