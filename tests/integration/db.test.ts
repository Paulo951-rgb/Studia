import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeDatabase } from '@/db/nodeDriver';
import { createRepositories } from '@/db';
import { SCHEMA_VERSION } from '@/db/schema';
import { createTestRepositories, seedSchool } from '../helpers/db';
import {
  ACCOUNT_ID,
  account,
  discussion,
  document,
  grade,
  homework,
  message,
  news,
  period,
} from '../helpers/fixtures';

test('migrations are idempotent and report the schema version', async () => {
  const db = createNodeDatabase(':memory:');
  const repos = createRepositories(db);
  const first = await repos.migrate();
  const second = await repos.migrate();
  assert.equal(first, SCHEMA_VERSION);
  assert.equal(second, 0, 'a second run applies nothing');
  assert.equal(await repos.schemaVersion(), SCHEMA_VERSION);
  await db.close();
});

test('every table required by the specification exists', async () => {
  const db = createNodeDatabase(':memory:');
  const repos = createRepositories(db);
  await repos.migrate();
  const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')");
  const names = new Set(rows.map((row) => row.name));
  const required = [
    'accounts',
    'sessions',
    'student_profile',
    'school_periods',
    'subjects',
    'grades',
    'averages',
    'report_cards',
    'report_card_subjects',
    'evaluations',
    'homework',
    'discussions',
    'messages',
    'attachments',
    'timetable',
    'events',
    'absences',
    'school_news',
    'canteen_menus',
    'documents',
    'conversations',
    'chat_messages',
    'ai_memories',
    'search_index',
    'sync_history',
    'sync_state',
    'settings',
  ];
  for (const table of required) assert.ok(names.has(table), `missing table ${table}`);
  await db.close();
});

test('FTS5 is available and the index stays in sync with deletes', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveNews(ACCOUNT_ID, [news]);
  let hits = await repos.search.search({ query: 'reunion', accountId: ACCOUNT_ID });
  assert.equal(hits.length, 1);

  await repos.search.remove('news', news.id);
  hits = await repos.search.search({ query: 'reunion', accountId: ACCOUNT_ID });
  assert.equal(hits.length, 0);
});

test('deleting an account cascades to every related row', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({})], false);
  await repos.writer.saveHomework(ACCOUNT_ID, [homework], false);
  await repos.writer.saveDiscussions(ACCOUNT_ID, [discussion]);
  await repos.writer.saveMessages(ACCOUNT_ID, discussion.id, [{ ...message, discussionId: discussion.id }]);
  await repos.writer.saveDocuments(ACCOUNT_ID, [document], false);

  await repos.accounts.remove(ACCOUNT_ID);

  const counts = await repos.school.counts(ACCOUNT_ID);
  assert.ok(Object.values(counts).every((count) => count === 0));
  const messages = await repos.db.get<{ c: number }>('SELECT count(*) AS c FROM messages');
  assert.equal(messages?.c, 0);
  const index = await repos.db.get<{ c: number }>('SELECT count(*) AS c FROM search_index WHERE account_id = ?', [ACCOUNT_ID]);
  assert.equal(index?.c, 0);
});

test('upserts keep stable identifiers instead of duplicating rows', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({ valuePoints: 11 })], false);
  const stats = await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({ valuePoints: 11 })], false);
  assert.equal(stats.inserted, 0);
  assert.equal(stats.unchanged, 1);

  const updated = await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({ valuePoints: 15 })], false);
  assert.equal(updated.updated, 1);
  const rows = await repos.school.listGrades({ accountId: ACCOUNT_ID, limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.valuePoints, 15);
});

test('a complete sync removes rows that disappeared from PRONOTE', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({}), grade({ id: 'gra_2', nativeId: 'G2' })], true);
  assert.equal((await repos.school.listGrades({ accountId: ACCOUNT_ID, limit: 10 })).length, 2);

  const stats = await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({})], true);
  assert.equal(stats.removed, 1);
  assert.equal((await repos.school.listGrades({ accountId: ACCOUNT_ID, limit: 10 })).length, 1);
});

test('conversations and messages are stored locally with FTS indexing', async () => {
  const repos = await createTestRepositories();
  await repos.chat.createConversation({
    id: 'conv_1',
    accountId: ACCOUNT_ID,
    title: 'Bilan du trimestre',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    memoryEnabled: true,
    model: 'gpt-4.1-mini',
    archived: false,
  });
  await repos.chat.addMessage({
    id: 'cm_1',
    conversationId: 'conv_1',
    role: 'user',
    contentText: 'Quelle est ma moyenne en mathématiques ?',
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    status: 'complete',
    errorCode: null,
    createdAt: '2026-03-01T00:00:01.000Z',
  });

  const conversations = await repos.chat.listConversations();
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0]?.title, 'Bilan du trimestre');

  const messages = await repos.chat.listMessages('conv_1');
  assert.equal(messages.length, 1);

  const hits = await repos.search.search({ query: 'moyenne', accountId: ACCOUNT_ID, kinds: ['chat_message'] });
  assert.equal(hits.length, 1);

  await repos.chat.deleteConversation('conv_1');
  assert.equal((await repos.chat.listMessages('conv_1')).length, 0);
  const afterDelete = await repos.search.search({ query: 'moyenne', accountId: ACCOUNT_ID, kinds: ['chat_message'] });
  assert.equal(afterDelete.length, 0);
});

test('conversation search matches message content through FTS5 and stays account-scoped', async () => {
  const repos = await createTestRepositories();
  const conversation = (id: string, title: string, accountId: string) => ({
    id,
    accountId,
    title,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    memoryEnabled: true,
    model: 'gpt-4.1-mini',
    archived: false,
  });
  const chatMessage = (id: string, conversationId: string, contentText: string) => ({
    id,
    conversationId,
    role: 'user' as const,
    contentText,
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    status: 'complete' as const,
    errorCode: null,
    createdAt: '2026-03-01T00:00:01.000Z',
  });

  await repos.chat.createConversation(conversation('conv_maths', 'Mathématiques', ACCOUNT_ID));
  await repos.chat.addMessage(chatMessage('cm_maths', 'conv_maths', 'Explique-moi le théorème de Pythagore.'));
  await repos.chat.createConversation(conversation('conv_history', 'Histoire', ACCOUNT_ID));
  await repos.chat.addMessage(chatMessage('cm_history', 'conv_history', 'Résume la révolution industrielle.'));
  await repos.accounts.save({ ...account, id: 'acc_other', displayName: 'Autre compte' });
  await repos.chat.createConversation(conversation('conv_other', 'Autre compte', 'acc_other'));
  await repos.chat.addMessage(chatMessage('cm_other', 'conv_other', 'Théorème de Pythagore, autre compte.'));

  const hits = await repos.chat.searchConversations(ACCOUNT_ID, 'pythagore');
  assert.deepEqual(hits.map((entry) => entry.id), ['conv_maths']);

  assert.equal((await repos.chat.searchConversations(ACCOUNT_ID, 'zzz')).length, 0);
  assert.equal((await repos.chat.searchConversations(ACCOUNT_ID, '   ')).length, 0);

  await repos.chat.deleteMessage('cm_maths');
  assert.equal((await repos.chat.searchConversations(ACCOUNT_ID, 'pythagore')).length, 0);
});

test('memories can be listed, cleared by scope and deleted', async () => {
  const repos = await createTestRepositories();
  const base = {
    accountId: ACCOUNT_ID,
    key: 'style',
    value: 'fiches courtes',
    source: 'manual' as const,
    confidence: null,
    conversationId: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: null,
  };
  await repos.writer.saveMemory({ ...base, id: 'mem_1', scope: 'user' });
  await repos.writer.saveMemory({ ...base, id: 'mem_2', scope: 'school', key: 'projet', value: 'brevet blanc en juin' });

  const all = await repos.writer.listMemories(ACCOUNT_ID);
  assert.equal(all.length, 2);

  const cleared = await repos.writer.clearMemories(ACCOUNT_ID, 'school');
  assert.equal(cleared, 1);
  assert.equal((await repos.writer.listMemories(ACCOUNT_ID)).length, 1);

  await repos.writer.deleteMemory('mem_1');
  assert.equal((await repos.writer.listMemories(ACCOUNT_ID)).length, 0);
});

test('settings round-trip values as strings', async () => {
  const repos = await createTestRepositories();
  await repos.settings.set('ai.model', 'gpt-4.1');
  assert.equal(await repos.settings.get('ai.model'), 'gpt-4.1');
  await repos.settings.set('ai.model', 'gpt-4.1-mini');
  assert.equal(await repos.settings.get('ai.model'), 'gpt-4.1-mini');
  await repos.settings.remove('ai.model');
  assert.equal(await repos.settings.get('ai.model'), null);
});

test('sessions never store the PRONOTE token itself', async () => {
  const repos = await createTestRepositories();
  await repos.sessions.save({
    id: 'sess_1',
    accountId: ACCOUNT_ID,
    deviceUuid: 'uuid-1',
    secretRef: 'pronote.token.acc_test',
    navigatorIdentifier: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    lastUsedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: null,
    invalidatedAt: null,
    invalidReason: null,
  });
  const row = await repos.db.get<Record<string, unknown>>('SELECT * FROM sessions WHERE id = ?', ['sess_1']);
  assert.ok(row);
  const serialized = JSON.stringify(row);
  assert.equal(serialized.includes('secret_ref'), true);
  assert.equal(serialized.includes('pronote.token.acc_test'), true);
  assert.equal(Object.keys(row).some((key) => /token|password|secret_value/i.test(key)), false);
  assert.equal(row['account_id'], account.id);
});

test('AI usage is aggregated locally without inventing a cost for unknown models', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.usage.record({
    id: 'use_1',
    accountId: ACCOUNT_ID,
    conversationId: null,
    model: 'gpt-4.1-mini',
    inputTokens: 1_000_000,
    outputTokens: 0,
    estimatedCostUsd: 0.4,
    createdAt: '2026-03-01T10:00:00.000Z',
  });
  await repos.usage.record({
    id: 'use_2',
    accountId: ACCOUNT_ID,
    conversationId: null,
    model: 'modele-inconnu',
    inputTokens: 500,
    outputTokens: 500,
    estimatedCostUsd: null,
    createdAt: '2026-03-02T10:00:00.000Z',
  });
  await repos.usage.record({
    id: 'use_old',
    accountId: ACCOUNT_ID,
    conversationId: null,
    model: 'gpt-4.1-mini',
    inputTokens: 10,
    outputTokens: 10,
    estimatedCostUsd: 0.1,
    createdAt: '2025-01-01T10:00:00.000Z',
  });

  const summary = await repos.usage.summary({ accountId: ACCOUNT_ID, since: '2026-03-01T00:00:00.000Z' });
  assert.equal(summary.requests, 2);
  assert.equal(summary.inputTokens, 1_000_500);
  assert.equal(summary.outputTokens, 500);
  assert.equal(summary.estimatedCostUsd, 0.4);
  assert.equal(summary.unknownCostRequests, 1);

  const recent = await repos.usage.recent(10);
  assert.equal(recent[0]?.id, 'use_2');

  await repos.accounts.remove(ACCOUNT_ID);
  assert.equal((await repos.usage.recent(10)).length, 0, 'deleting the account clears its usage history');
});
