import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredGradeForTarget, subjectProgress, upcomingTests, weakSubjects } from '@/core/school/insights';
import type { Evaluation } from '@/core/domain/types';
import { grade, period, timetableClass } from '../helpers/fixtures';

function evaluation(overrides: Partial<Evaluation>): Evaluation {
  return {
    id: 'eva_1',
    accountId: 'acc_test',
    nativeId: 'E1',
    periodId: period.id,
    subjectId: null,
    subjectName: 'Mathématiques',
    name: 'Contrôle',
    teacher: 'M. Bernard',
    coefficient: 1,
    description: '',
    evaluatedAt: '2026-03-10T08:00:00.000Z',
    levels: [],
    skills: [],
    updatedAt: '2026-03-01T00:00:00.000Z',
    syncedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

const now = new Date('2026-03-05T08:00:00.000Z');

test('upcoming tests merge evaluations and timetable tests inside the window', () => {
  const tests = upcomingTests(
    [
      evaluation({ id: 'eva_soon', nativeId: 'E1', evaluatedAt: '2026-03-10T08:00:00.000Z' }),
      evaluation({ id: 'eva_past', nativeId: 'E2', evaluatedAt: '2026-02-10T08:00:00.000Z' }),
      evaluation({ id: 'eva_far', nativeId: 'E3', evaluatedAt: '2026-06-10T08:00:00.000Z' }),
    ],
    [
      { ...timetableClass, id: 'tt_test', nativeId: 'T1', isTest: true, startsAt: '2026-03-12T09:00:00.000Z' },
      { ...timetableClass, id: 'tt_canceled', nativeId: 'T2', isTest: true, canceled: true, startsAt: '2026-03-11T09:00:00.000Z' },
    ],
    now,
    14,
  );

  assert.deepEqual(
    tests.map((entry) => entry.date),
    ['2026-03-10T08:00:00.000Z', '2026-03-12T09:00:00.000Z'],
  );
  assert.deepEqual(tests.map((entry) => entry.source), ['evaluation', 'timetable']);
});

test('subject progress keeps periods in order and prefers the PRONOTE average', () => {
  const second = { ...period, id: 'per_2', nativeId: 'P2', name: 'Trimestre 2', startDate: '2026-01-05' };
  const rows = subjectProgress(
    [{ id: 'sub_maths', accountId: 'acc', nativeId: 'S1', name: 'Mathématiques', inGroups: false, updatedAt: '', syncedAt: '' }],
    [second, period],
    [
      { subjectId: 'sub_maths', periodId: period.id, studentValue: 12, source: 'computed' },
      { subjectId: 'sub_maths', periodId: period.id, studentValue: 12.5, source: 'pronote' },
      { subjectId: 'sub_maths', periodId: 'per_2', studentValue: 14, source: 'pronote' },
    ],
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.points, [
    { period: period.name, value: 12.5, source: 'pronote' },
    { period: 'Trimestre 2', value: 14, source: 'pronote' },
  ]);
  assert.equal(rows[0]?.delta, 1.5);
  assert.equal(rows[0]?.trend, 'up');
});

test('the needed mark is exact arithmetic, and flags unreachable targets', () => {
  const grades = [
    grade({ valuePoints: 10, coefficient: 1 }),
    grade({ id: 'gra_b', nativeId: 'GB', valuePoints: 14, coefficient: 1 }),
  ];

  const reachable = requiredGradeForTarget(grades, 13, 1);
  assert.equal(reachable.currentAverage, 12);
  assert.equal(reachable.needed, 15);
  assert.equal(reachable.status, 'possible');

  const impossible = requiredGradeForTarget(grades, 20, 1);
  assert.equal(impossible.needed, 36);
  assert.equal(impossible.status, 'impossible');

  // Even a zero keeps the average at or above the target: nothing to aim for.
  const alreadyThere = requiredGradeForTarget(grades, 8, 1);
  assert.equal(alreadyThere.status, 'reached');
  assert.equal(alreadyThere.needed, 0);

  const empty = requiredGradeForTarget([], 12, 1);
  assert.equal(empty.status, 'no_data');
  assert.equal(empty.currentAverage, null);
});

test('bonus and optional grades do not distort the target computation', () => {
  const grades = [
    grade({ valuePoints: 10, coefficient: 1 }),
    grade({ id: 'gra_bonus', nativeId: 'GB1', valuePoints: 18, coefficient: 1, isBonus: true }),
    grade({ id: 'gra_opt', nativeId: 'GO1', valuePoints: 19, coefficient: 1, isOptional: true }),
  ];
  const result = requiredGradeForTarget(grades, 12, 1);
  assert.equal(result.currentAverage, 10);
  assert.equal(result.needed, 14);
});

test('weak subjects are those clearly under the overall average', () => {
  const rows = [
    { subject: 'Mathématiques', average: 8, worstGrade: '4/20 le 2026-02-01' },
    { subject: 'Français', average: 13 },
    { subject: 'Anglais', average: 10.5 },
  ];
  const list = weakSubjects(rows, 12, 1, 5);
  assert.deepEqual(list.map((entry) => entry.subject), ['Mathématiques', 'Anglais']);
  assert.equal(list[0]?.gapToOverall, -4);
  assert.equal(weakSubjects(rows, null, 1, 5).length, 0);
});
