import test from 'node:test';
import assert from 'node:assert/strict';
import { planRegeneration } from '@/core/ai/conversation';
import type { ChatMessage } from '@/core/domain/types';

function message(id: string, role: ChatMessage['role'], contentText: string): ChatMessage {
  return {
    id,
    conversationId: 'conv_1',
    role,
    contentText,
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    status: 'complete',
    errorCode: null,
    createdAt: '2026-11-21T10:00:00.000Z',
  };
}

test('regeneration replays the last question and drops the trailing turn', () => {
  const plan = planRegeneration([
    message('m1', 'user', 'Première question'),
    message('m2', 'assistant', 'Première réponse'),
    message('m3', 'user', 'Deuxième question'),
    message('m4', 'assistant', 'Deuxième réponse'),
  ]);
  assert.ok(plan);
  assert.equal(plan.text, 'Deuxième question');
  assert.deepEqual(plan.deleteIds, ['m3', 'm4']);
});

test('regeneration keeps earlier turns untouched', () => {
  const plan = planRegeneration([
    message('m1', 'user', 'Question'),
    message('m2', 'assistant', 'Réponse'),
  ]);
  assert.deepEqual(plan?.deleteIds, ['m1', 'm2']);
});

test('regeneration returns null when there is nothing to replay', () => {
  assert.equal(planRegeneration([]), null);
  assert.equal(planRegeneration([message('m1', 'assistant', 'Bonjour')]), null);
  assert.equal(planRegeneration([message('m1', 'user', '   ')]), null);
});
