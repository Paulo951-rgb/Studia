import test from 'node:test';
import assert from 'node:assert/strict';
import { runSync, type SyncSource } from '@/core/sync/engine';
import { createTestRepositories } from '../helpers/db';
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
  maths,
  message,
  news,
  period,
  profile,
  timetableClass,
} from '../helpers/fixtures';
import { TAB_LOCATIONS } from '@/core/pronote/capabilities';

type FakeOptions = {
  tabs?: number[];
  failOn?: { method: keyof SyncSource; error: Error };
  grades?: ReturnType<typeof grade>[];
};

function createFakeSource(options: FakeOptions = {}): SyncSource & { calls: string[] } {
  const calls: string[] = [];
  const tabs = options.tabs ?? [
    TAB_LOCATIONS.grades,
    TAB_LOCATIONS.gradebook,
    TAB_LOCATIONS.evaluations,
    TAB_LOCATIONS.assignments,
    TAB_LOCATIONS.discussions,
    TAB_LOCATIONS.timetable,
    TAB_LOCATIONS.notebook,
    TAB_LOCATIONS.news,
    TAB_LOCATIONS.menus,
    TAB_LOCATIONS.resources,
  ];

  const track = (method: string) => {
    calls.push(method);
    if (options.failOn?.method === method) throw options.failOn.error;
  };

  return {
    calls,
    authorizedTabs: () => tabs,
    async fetchProfile() {
      track('fetchProfile');
      return profile;
    },
    async fetchPeriods() {
      track('fetchPeriods');
      return { periods: [period], defaultPeriodId: period.id };
    },
    async fetchSubjects() {
      track('fetchSubjects');
      return [maths];
    },
    async fetchGrades() {
      track('fetchGrades');
      return {
        grades: options.grades ?? [grade({ valuePoints: 14 }), grade({ id: 'gra_2', nativeId: 'G2', valuePoints: 8 })],
        averages: [average],
        subjects: [maths],
      };
    },
    async fetchReportCard() {
      track('fetchReportCard');
      return {
        reportCard: {
          id: 'rc_1',
          accountId: ACCOUNT_ID,
          periodId: period.id,
          generalComment: 'Trimestre satisfaisant',
          overallAssessments: [{ name: 'Mention', value: 'Bien' }],
          sourceUrl: null,
          updatedAt: '2026-03-01T00:00:00.000Z',
          syncedAt: '2026-03-01T00:00:00.000Z',
        },
        subjects: [
          {
            id: 'rcs_1',
            reportCardId: 'rc_1',
            accountId: ACCOUNT_ID,
            subjectId: maths.id,
            subjectName: maths.name,
            subjectGroup: '',
            coefficient: 4,
            studentAverage: 13.5,
            classAverage: 12,
            minValue: 5,
            maxValue: 19,
            teachers: ['M. Bernard'],
            assessments: ['Bon trimestre'],
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        averages: [average],
        subjectsCatalog: [maths],
      };
    },
    async fetchEvaluations() {
      track('fetchEvaluations');
      return [];
    },
    async fetchHomework() {
      track('fetchHomework');
      return [homework];
    },
    async fetchDiscussions() {
      track('fetchDiscussions');
      return [discussion];
    },
    async fetchMessages() {
      track('fetchMessages');
      return [{ ...message, discussionId: discussion.id }];
    },
    async fetchTimetable() {
      track('fetchTimetable');
      return [timetableClass];
    },
    async fetchEvents() {
      track('fetchEvents');
      return [event];
    },
    async fetchAbsences() {
      track('fetchAbsences');
      return [absence];
    },
    async fetchNews() {
      track('fetchNews');
      return [news];
    },
    async fetchCanteen() {
      track('fetchCanteen');
      return [canteenMenu];
    },
    async fetchDocuments() {
      track('fetchDocuments');
      return [document];
    },
  };
}

const fixedNow = () => new Date('2026-03-05T08:00:00.000Z');

test('an initial sync imports every authorised resource and records history', async () => {
  const repos = await createTestRepositories();
  const source = createFakeSource();
  const summary = await runSync({ repos, source, accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });

  assert.equal(summary.status, 'ok');
  assert.equal(summary.resources['grades']?.status, 'ok');
  assert.ok(summary.requests > 0);

  const counts = await repos.school.counts(ACCOUNT_ID);
  assert.equal(counts['grades'], 2);
  assert.equal(counts['homework'], 1);
  assert.equal(counts['messages'], 1);
  assert.equal(counts['timetable'], 1);
  assert.equal(counts['school_news'], 1);
  assert.equal(counts['canteen_menus'], 1);
  assert.equal(counts['documents'], 1);

  const account = await repos.accounts.get(ACCOUNT_ID);
  assert.equal(account?.lastSyncAt, '2026-03-05T08:00:00.000Z');

  const history = await repos.sync.listRuns(ACCOUNT_ID, 5);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.status, 'ok');
});

test('a second sync does not duplicate rows and updates changed grades', async () => {
  const repos = await createTestRepositories();
  const first = createFakeSource();
  await runSync({ repos, source: first, accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });
  const before = await repos.school.counts(ACCOUNT_ID);

  const second = createFakeSource({ grades: [grade({ valuePoints: 16 }), grade({ id: 'gra_2', nativeId: 'G2', valuePoints: 8 })] });
  const summary = await runSync({ repos, source: second, accountId: ACCOUNT_ID, kind: 'incremental', now: fixedNow });
  assert.equal(summary.status, 'ok');

  const after = await repos.school.counts(ACCOUNT_ID);
  assert.deepEqual(after, before);

  const grades = await repos.school.listGrades({ accountId: ACCOUNT_ID, limit: 10 });
  const updated = grades.find((entry) => entry.nativeId === 'G1');
  assert.equal(updated?.valuePoints, 16);
});

test('local computed averages are produced without overwriting PRONOTE averages', async () => {
  const repos = await createTestRepositories();
  await runSync({ repos, source: createFakeSource(), accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });

  const averages = await repos.school.listAverages({ accountId: ACCOUNT_ID, periodId: period.id });
  const pronote = averages.filter((entry) => entry.source === 'pronote');
  const computed = averages.filter((entry) => entry.source === 'computed');
  assert.ok(pronote.length >= 1);
  assert.equal(pronote.find((entry) => entry.subjectId === maths.id)?.studentValue, 13.5);
  assert.ok(computed.every((entry) => entry.subjectId !== maths.id || entry.studentValue !== 13.5));
});

test('resources behind an unauthorised tab are skipped, not faked', async () => {
  const repos = await createTestRepositories();
  const source = createFakeSource({ tabs: [TAB_LOCATIONS.grades] });
  const summary = await runSync({ repos, source, accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });

  assert.equal(summary.resources['messages']?.status, 'skipped');
  assert.equal(summary.resources['messages']?.errorCode, 'not_authorized_tab');
  assert.equal(summary.resources['canteen']?.status, 'skipped');
  const counts = await repos.school.counts(ACCOUNT_ID);
  assert.equal(counts['messages'], 0);
  assert.equal(counts['canteen_menus'], 0);
});

test('an expired session stops the sync and flags the account for re-authentication', async () => {
  const repos = await createTestRepositories();
  const error = new Error('The session has expired');
  error.name = 'SessionExpiredError';
  const source = createFakeSource({ failOn: { method: 'fetchGrades', error } });
  const summary = await runSync({ repos, source, accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });

  assert.equal(summary.requiresReauth, true);
  assert.equal(summary.errorCode, 'session_expired');
  assert.notEqual(summary.status, 'ok');
  const account = await repos.accounts.get(ACCOUNT_ID);
  assert.equal(account?.status, 'expired');
});

test('the request budget stops the run instead of hammering the school server', async () => {
  const repos = await createTestRepositories();
  const source = createFakeSource();
  const summary = await runSync({ repos, source, accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow, requestBudget: 3 });

  assert.equal(summary.status, 'aborted');
  const skipped = Object.values(summary.resources).filter((report) => report.errorCode === 'request_budget_exceeded');
  assert.ok(skipped.length > 0);
  assert.ok(summary.requests <= 4);
});

test('an aborted signal leaves the sync partial and keeps stored data', async () => {
  const repos = await createTestRepositories();
  const controller = new AbortController();
  controller.abort();
  const source = createFakeSource();
  const summary = await runSync({
    repos,
    source,
    accountId: ACCOUNT_ID,
    kind: 'manual',
    now: fixedNow,
    signal: controller.signal,
  });
  assert.equal(summary.status, 'aborted');
  assert.equal(summary.resources['profile']?.status, 'skipped');
});

test('a rate-limited school server is reported as retryable and does not erase data', async () => {
  const repos = await createTestRepositories();
  await runSync({ repos, source: createFakeSource(), accountId: ACCOUNT_ID, kind: 'initial', now: fixedNow });

  const error = new Error("You've been rate-limited");
  error.name = 'RateLimitedError';
  const summary = await runSync({
    repos,
    source: createFakeSource({ failOn: { method: 'fetchHomework', error } }),
    accountId: ACCOUNT_ID,
    kind: 'incremental',
    now: fixedNow,
  });

  assert.equal(summary.resources['homework']?.errorCode, 'rate_limited');
  const counts = await repos.school.counts(ACCOUNT_ID);
  assert.equal(counts['homework'], 1);
});
