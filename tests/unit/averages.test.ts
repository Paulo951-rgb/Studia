import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGradesAverage,
  computeOverallAverage,
  simulateGrade,
  buildProgression,
  normaliseGrade,
  formatAverage,
  round2,
} from '@/core/school/averages';
import { grade, maths, french, period, period2 } from '../helpers/fixtures';

test('weighted average uses coefficients and converts to /20', () => {
  const result = computeGradesAverage([
    grade({ id: 'a', valuePoints: 10, outOfPoints: 20, coefficient: 2 }),
    grade({ id: 'b', valuePoints: 15, outOfPoints: 20, coefficient: 1 }),
  ]);
  // (10*2 + 15*1) / 3 = 11.666… → 11.67
  assert.equal(result.value, 11.67);
  assert.equal(result.method, 'coefficients');
  assert.equal(result.countedGrades, 2);
});

test('grades out of another scale are normalised to /20', () => {
  const normalised = normaliseGrade(grade({ valuePoints: 7, outOfPoints: 10 }));
  assert.equal(normalised.points20, 14);
  assert.equal(normalised.counts, true);
});

test('absent, exempted and not graded values are excluded, zeros count', () => {
  const excluded = computeGradesAverage([
    grade({ id: 'a', valuePoints: null, valueKind: 1 }),
    grade({ id: 'b', valuePoints: null, valueKind: 2 }),
    grade({ id: 'c', valuePoints: null, valueKind: 3 }),
    grade({ id: 'd', valuePoints: 14 }),
  ]);
  assert.equal(excluded.value, 14);
  assert.equal(excluded.countedGrades, 1);
  assert.equal(excluded.excludedGrades, 3);

  const withZero = computeGradesAverage([
    grade({ id: 'a', valuePoints: 10, coefficient: 1 }),
    grade({ id: 'b', valuePoints: null, valueKind: 6, coefficient: 1 }),
  ]);
  assert.equal(withZero.value, 5);
  assert.equal(withZero.countedGrades, 2);
});

test('bonus grades only add points above 10 and do not weigh in the denominator', () => {
  const result = computeGradesAverage([
    grade({ id: 'a', valuePoints: 12, coefficient: 2 }),
    grade({ id: 'b', valuePoints: 18, isBonus: true }),
  ]);
  // 12 + (18-10)/2 = 16
  assert.equal(result.value, 16);
});

test('a bonus below 10 never lowers the average', () => {
  const result = computeGradesAverage([
    grade({ id: 'a', valuePoints: 12, coefficient: 1 }),
    grade({ id: 'b', valuePoints: 4, isBonus: true }),
  ]);
  assert.equal(result.value, 12);
});

test('optional grades are kept only when they raise the average', () => {
  const improving = computeGradesAverage([
    grade({ id: 'a', valuePoints: 10, coefficient: 1 }),
    grade({ id: 'b', valuePoints: 16, coefficient: 1, isOptional: true }),
  ]);
  assert.equal(improving.value, 13);

  const lowering = computeGradesAverage([
    grade({ id: 'a', valuePoints: 14, coefficient: 1 }),
    grade({ id: 'b', valuePoints: 6, coefficient: 1, isOptional: true }),
  ]);
  assert.equal(lowering.value, 14);
});

test('an empty grade list yields null, never zero', () => {
  const result = computeGradesAverage([]);
  assert.equal(result.value, null);
  assert.equal(result.method, 'none');
});

test('overall average is weighted when subject coefficients exist and flagged as estimate otherwise', () => {
  const weighted = computeOverallAverage([
    { subjectId: maths.id, subjectName: maths.name, grades: [grade({ valuePoints: 16 })], subjectCoefficient: 4 },
    { subjectId: french.id, subjectName: french.name, grades: [grade({ valuePoints: 8 })], subjectCoefficient: 1 },
  ]);
  assert.equal(weighted.value, round2((16 * 4 + 8 * 1) / 5));
  assert.equal(weighted.method, 'subject-coefficients');
  assert.equal(weighted.isEstimate, false);

  const equal = computeOverallAverage([
    { subjectId: maths.id, subjectName: maths.name, grades: [grade({ valuePoints: 16 })] },
    { subjectId: french.id, subjectName: french.name, grades: [grade({ valuePoints: 8 })] },
  ]);
  assert.equal(equal.value, 12);
  assert.equal(equal.method, 'equal-weights');
  assert.equal(equal.isEstimate, true);
});

test('simulation returns before/after and refuses impossible values', () => {
  const result = simulateGrade({
    currentGrades: [grade({ valuePoints: 10, coefficient: 1 })],
    hypothetical: { points: 16, outOf: 20, coefficient: 1 },
  });
  assert.equal(result.currentAverage, 10);
  assert.equal(result.simulatedAverage, 13);
  assert.equal(result.delta, 3);
  assert.equal(result.isSimulation, true);

  assert.throws(() => simulateGrade({ currentGrades: [], hypothetical: { points: 25 } }), /comprise entre 0 et 20/);
  assert.throws(() => simulateGrade({ currentGrades: [], hypothetical: { points: 10, coefficient: 0 } }), /coefficient/);
});

test('progression is ordered by period start date', () => {
  const points = buildProgression([
    { periodId: period2.id, periodName: period2.name, startDate: period2.startDate, grades: [grade({ valuePoints: 14 })] },
    { periodId: period.id, periodName: period.name, startDate: period.startDate, grades: [grade({ valuePoints: 9 })] },
  ]);
  assert.deepEqual(
    points.map((point) => point.periodName),
    ['Trimestre 1', 'Trimestre 2'],
  );
  assert.deepEqual(
    points.map((point) => point.value),
    [9, 14],
  );
});

test('average formatting uses a French decimal comma and an em dash when unknown', () => {
  assert.equal(formatAverage(12.5), '12,50/20');
  assert.equal(formatAverage(null), '—');
});
