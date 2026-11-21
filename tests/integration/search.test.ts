import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchExpression, tokenizeQuery, likePattern } from '@/core/search/query';
import { createTestRepositories, seedSchool } from '../helpers/db';
import { ACCOUNT_ID, discussion, message, news, document, homework, grade } from '../helpers/fixtures';

test('query tokens are accent-insensitive, lowercased and bounded', () => {
  assert.deepEqual(tokenizeQuery('Théorème de Thalès'), ['theoreme', 'de', 'thales']);
  assert.equal(tokenizeQuery('a b c').length, 0);
  assert.ok(tokenizeQuery(Array.from({ length: 40 }, (_, index) => `mot${index}`).join(' ')).length <= 12);
});

test('FTS operators from user input are neutralised', () => {
  const expression = buildMatchExpression('maths OR "notes" NEAR(3) -supprim*');
  assert.ok(expression);
  assert.equal(expression.includes(' OR '), false);
  assert.equal(expression.includes('NEAR'), false);
  for (const token of ['"maths"', '"notes"', '"supprim"', '"near"']) {
    assert.ok(expression.includes(token), `${token} missing from ${expression}`);
  }
  assert.equal(expression.includes('OR'), false);
  assert.equal(expression.includes('NEAR'), false);
  assert.equal(expression.includes('"'), true);
});

test('LIKE patterns escape wildcards', () => {
  assert.equal(likePattern('100%_ok'), '%100\\%\\_ok%');
});

test('full-text search finds messages with accents and returns snippets', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveDiscussions(ACCOUNT_ID, [discussion]);
  await repos.writer.saveMessages(ACCOUNT_ID, discussion.id, [{ ...message, discussionId: discussion.id }]);
  await repos.writer.saveNews(ACCOUNT_ID, [news]);
  await repos.writer.saveDocuments(ACCOUNT_ID, [document], false);
  await repos.writer.saveHomework(ACCOUNT_ID, [homework], false);

  const byWord = await repos.search.search({ query: 'autorisation', accountId: ACCOUNT_ID });
  assert.ok(byWord.length >= 1);
  assert.equal(byWord[0]?.kind, 'message');
  assert.ok(byWord[0]?.snippet.length > 0);

  const accentInsensitive = await repos.search.search({ query: 'theoreme', accountId: ACCOUNT_ID });
  assert.ok(accentInsensitive.some((hit) => hit.kind === 'document'));

  const kindFiltered = await repos.search.search({ query: 'mars', accountId: ACCOUNT_ID, kinds: ['news'] });
  assert.ok(kindFiltered.every((hit) => hit.kind === 'news'));
});

test('search never leaks data from another account', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveNews(ACCOUNT_ID, [news]);
  const foreign = await repos.search.search({ query: 'reunion', accountId: 'acc_autre' });
  assert.deepEqual(foreign, []);
});

test('grade comments are indexed for teacher feedback search', async () => {
  const repos = await createTestRepositories();
  await seedSchool(repos);
  await repos.writer.saveGrades(
    ACCOUNT_ID,
    'per_t1',
    [grade({ id: 'gra_c', nativeId: 'GC1', comment: 'Des progrès nets en géométrie', valuePoints: 15 })],
    false,
  );
  const hits = await repos.search.search({ query: 'geometrie', accountId: ACCOUNT_ID, kinds: ['grade_comment'] });
  assert.equal(hits.length, 1);
  assert.match(hits[0]?.snippet ?? '', /géométrie/i);
});
