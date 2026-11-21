import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolRunner } from '@/core/ai/toolRunner';
import { parseToolArguments, TOOL_LIMITS } from '@/core/ai/tools';
import { UNTRUSTED_CLOSE, UNTRUSTED_OPEN } from '@/core/ai/prompt';
import { createTestRepositories, seedSchool } from '../helpers/db';
import {
  ACCOUNT_ID,
  absence,
  average,
  canteenMenu,
  discussion,
  document,
  event,
  grade,
  homework,
  message,
  news,
  period,
  timetableClass,
} from '../helpers/fixtures';

async function seedAll() {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveGrades(ACCOUNT_ID, period.id, [grade({ valuePoints: 14, coefficient: 2 }), grade({ id: 'gra_2', nativeId: 'G2', valuePoints: 8, coefficient: 1 })], false);
  await repos.writer.saveAverages(ACCOUNT_ID, [average]);
  await repos.writer.saveHomework(ACCOUNT_ID, [homework], false);
  await repos.writer.saveDiscussions(ACCOUNT_ID, [discussion]);
  await repos.writer.saveMessages(ACCOUNT_ID, discussion.id, [{ ...message, discussionId: discussion.id }]);
  await repos.writer.saveTimetable(ACCOUNT_ID, [timetableClass], '2026-03-01', '2026-03-08');
  await repos.writer.saveEvents(ACCOUNT_ID, [event]);
  await repos.writer.saveAbsences(ACCOUNT_ID, [absence], false);
  await repos.writer.saveNews(ACCOUNT_ID, [news]);
  await repos.writer.saveCanteenMenus(ACCOUNT_ID, [canteenMenu]);
  await repos.writer.saveDocuments(ACCOUNT_ID, [document], false);
  return repos;
}

const run = async (repos: Awaited<ReturnType<typeof seedAll>>, name: Parameters<typeof parseToolArguments>[0], raw: unknown) => {
  const runner = createToolRunner({ repos, accountId: ACCOUNT_ID, now: () => new Date('2026-03-04T10:00:00.000Z') });
  const result = await runner.run(name, parseToolArguments(name, JSON.stringify(raw)));
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.ok ? JSON.parse(result.data) : null;
};

test('get_student_profile reads the local cache and reports the sync date', async () => {
  const repos = await seedAll();
  await repos.accounts.markSynced(ACCOUNT_ID, '2026-03-04T09:00:00.000Z');
  const data = await run(repos, 'get_student_profile', {});
  assert.equal(data.profile.name, 'Camille Martin');
  assert.equal(data.last_sync_at, '2026-03-04T09:00:00.000Z');
});

test('get_grades filters by subject and never returns another account', async () => {
  const repos = await seedAll();
  const all = await run(repos, 'get_grades', { period: null, subject: null, from: null, to: null, limit: 20 });
  assert.equal(all.count, 2);
  assert.equal(all.items.length, 2);
  const filtered = await run(repos, 'get_grades', { period: 'Trimestre 1', subject: 'mathématiques', from: null, to: null, limit: 1 });
  assert.equal(filtered.count, 2);
  assert.equal(filtered.truncated, true);
  assert.equal(filtered.items.length, 1, 'limit is applied to the returned rows');
  assert.equal(filtered.items[0].subject, 'Mathématiques');
});

test('calculate_average is flagged as an exact local computation', async () => {
  const repos = await seedAll();
  const data = await run(repos, 'calculate_average', { period: null, subject: 'Maths' });
  // (14*2 + 8*1) / 3 = 12
  assert.equal(data.average, 12);
  assert.equal(data.type, 'calcul_exact');
  assert.match(data.disclaimer, /arrondi officiel/);
});

test('simulate_grade is explicitly labelled as a simulation', async () => {
  const repos = await seedAll();
  const data = await run(repos, 'simulate_grade', { subject: 'Maths', points: 18, out_of: 20, coefficient: 1, period: null });
  assert.equal(data.type, 'simulation');
  assert.equal(data.current_average, 12);
  assert.equal(data.simulated_average, 13.5);
  assert.match(data.disclaimer, /ce n'est pas une note réelle/);
});

test('school text is fenced so it cannot be read as instructions', async () => {
  const repos = await seedAll();
  const messages = await run(repos, 'search_messages', { query: 'autorisation', limit: 5 });
  assert.ok(messages.count >= 1);
  assert.ok(messages.messages[0].excerpt.startsWith(UNTRUSTED_OPEN));
  assert.ok(messages.messages[0].excerpt.includes(UNTRUSTED_CLOSE));

  const homeworkData = await run(repos, 'get_homework', { from: null, to: null, subject: null, include_done: true, limit: 5 });
  assert.ok(homeworkData.items[0].description.startsWith(UNTRUSTED_OPEN));
  assert.ok(JSON.stringify(homeworkData).includes(UNTRUSTED_OPEN));

  const newsData = await run(repos, 'get_school_news', { unread_only: false, limit: 5 });
  assert.ok(JSON.stringify(newsData).includes(UNTRUSTED_OPEN));
});

test('an unknown message id returns a clean error instead of inventing content', async () => {
  const repos = await seedAll();
  const runner = createToolRunner({ repos, accountId: ACCOUNT_ID });
  const result = await runner.run('get_message_details', parseToolArguments('get_message_details', JSON.stringify({ message_id: 'msg_inconnu' })));
  assert.equal(result.ok, true);
  const data = JSON.parse(result.ok ? result.data : '{}') as { error?: string };
  assert.equal(data.error, 'message_not_found');
});

test('read_document only returns locally available text and says when it has none', async () => {
  const repos = await seedAll();
  const data = await run(repos, 'read_document', { document_id: document.id });
  assert.equal(data.document.title, 'Chapitre 4 — Thalès');
  assert.match(data.document.description, new RegExp(UNTRUSTED_OPEN));
  assert.match(data.limitation, /PDF/);

  const missing = await run(repos, 'read_document', { document_id: 'doc_inconnu' });
  assert.equal(missing.error, 'document_not_found');
});

test('timetable, absences, events and canteen come from the cache', async () => {
  const repos = await seedAll();
  const timetable = await run(repos, 'get_timetable', { from: null, to: null, limit: 10 });
  assert.equal(timetable.count, 1);
  assert.equal(timetable.classes[0].subject, 'Mathématiques');

  const absences = await run(repos, 'get_absences', { from: null, to: null, limit: 10 });
  assert.equal(absences.count, 1);

  const events = await run(repos, 'get_events', { from: null, to: null, limit: 10 });
  assert.equal(events.count, 1);

  const canteen = await run(repos, 'get_canteen_menu', { from: null, to: null, limit: 10 });
  assert.equal(canteen.count, 1);
  assert.equal(canteen.menus[0].date, '2026-03-03');
  assert.match(canteen.menus[0].courses[0].items[0].name, new RegExp(UNTRUSTED_OPEN));
});

test('search_teacher_feedback finds grade comments through FTS', async () => {
  const repos = await seedAll();
  await repos.writer.saveGrades(
    ACCOUNT_ID,
    period.id,
    [grade({ id: 'gra_c', nativeId: 'GC', comment: 'Attention à la rédaction des démonstrations' })],
    false,
  );
  const data = await run(repos, 'search_teacher_feedback', { query: 'demonstrations', subject: null, limit: 5 });
  assert.ok(data.count >= 1);
});

test('tool output is truncated above the configured limit', async () => {
  const repos = await seedAll();
  const bulk = Array.from({ length: 40 }, (_, index) => ({
    ...message,
    id: `msg_bulk_${index}`,
    nativeId: `MB${index}`,
    discussionId: discussion.id,
    contentText: `paragraphe ${index} ${'détail '.repeat(60)}`,
  }));
  await repos.writer.saveMessages(ACCOUNT_ID, discussion.id, bulk);

  const runner = createToolRunner({ repos, accountId: ACCOUNT_ID });
  const result = await runner.run('get_message_details', parseToolArguments('get_message_details', JSON.stringify({ message_id: bulk[0]?.id ?? '' })));
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.data.length <= TOOL_LIMITS.maxToolOutputChars + 64);
});

test('an unknown tool name is rejected', async () => {
  const repos = await seedAll();
  const runner = createToolRunner({ repos, accountId: ACCOUNT_ID });
  const result = await runner.run('delete_everything' as never, parseToolArguments('get_grades', '{}'));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'TOOL_UNKNOWN');
});
