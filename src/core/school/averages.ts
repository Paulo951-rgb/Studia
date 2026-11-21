import type { Grade } from '@/core/domain/types';

/**
 * Grade arithmetic.
 *
 * Everything here is *exact given the stored data*: it re-applies the coefficients
 * PRONOTE returned. It is not a re-implementation of PRONOTE's internal rounding
 * rules, so results are labelled as "computed" and never mixed with the averages
 * sent by PRONOTE (stored with source = 'pronote').
 */

/** PRONOTE grade kinds that carry no usable numeric value. */
export const NON_NUMERIC_GRADE_KINDS = new Set([-1, 1, 2, 3, 4, 8]);

/** Grade kinds that must count as a zero. */
export const ZERO_GRADE_KINDS = new Set([6, 7]);

export type NormalisedGrade = {
  grade: Grade;
  points20: number;
  coefficient: number;
  counts: boolean;
};

export function normaliseGrade(grade: Grade): NormalisedGrade {
  const outOf = grade.outOfPoints ?? 20;
  const hasNumericValue = grade.valuePoints !== null && !NON_NUMERIC_GRADE_KINDS.has(grade.valueKind);
  const isZero = ZERO_GRADE_KINDS.has(grade.valueKind);

  if (!hasNumericValue && !isZero) {
    return { grade, points20: 0, coefficient: 0, counts: false };
  }

  const rawPoints = hasNumericValue ? (grade.valuePoints as number) : 0;
  const points20 = outOf > 0 ? (rawPoints / outOf) * 20 : rawPoints;

  return {
    grade,
    points20,
    coefficient: grade.isBonus ? 0 : grade.coefficient,
    counts: true,
  };
}

export type ComputedAverage = {
  value: number | null;
  outOf: 20;
  countedGrades: number;
  excludedGrades: number;
  method: 'coefficients' | 'none';
};

function weightedAverage(entries: NormalisedGrade[]): ComputedAverage {
  const regular = entries.filter((entry) => entry.counts && !entry.grade.isBonus && entry.coefficient > 0);
  const bonus = entries.filter((entry) => entry.counts && entry.grade.isBonus);

  const coefficientSum = regular.reduce((total, entry) => total + entry.coefficient, 0);
  const excluded = entries.filter((entry) => !entry.counts || (!entry.grade.isBonus && entry.coefficient <= 0)).length;

  if (coefficientSum === 0 && bonus.length === 0) {
    return { value: null, outOf: 20, countedGrades: 0, excludedGrades: excluded, method: 'none' };
  }

  const pointsSum = regular.reduce((total, entry) => total + entry.points20 * entry.coefficient, 0);
  const bonusPoints = bonus.reduce((total, entry) => total + Math.max(0, entry.points20 - 10), 0);
  const denominator = coefficientSum === 0 ? 1 : coefficientSum;

  return {
    value: round2(pointsSum / denominator + bonusPoints / denominator),
    outOf: 20,
    countedGrades: regular.length + bonus.length,
    excludedGrades: excluded,
    method: 'coefficients',
  };
}

/**
 * Optional grades ("note facultative") only count when they improve the average.
 * We therefore compute both variants and keep the better one, which is the rule
 * PRONOTE applies for optional grades.
 */
export function computeGradesAverage(grades: Grade[]): ComputedAverage {
  const entries = grades.map(normaliseGrade);
  const optional = entries.filter((entry) => entry.counts && entry.grade.isOptional);
  const base = entries.filter((entry) => !(entry.counts && entry.grade.isOptional));

  const withoutOptional = weightedAverage(base);
  if (optional.length === 0) return withoutOptional;

  const withOptional = weightedAverage([...base, ...optional]);
  if (withoutOptional.value === null) return withOptional;
  if (withOptional.value === null) return withoutOptional;
  return withOptional.value >= withoutOptional.value ? withOptional : withoutOptional;
}

export type SubjectAverageInput = {
  subjectId: string;
  subjectName: string;
  grades: Grade[];
  /** Coefficient of the subject, when the report card or the gradebook provides it. */
  subjectCoefficient?: number | null;
};

export type SubjectAverageResult = {
  subjectId: string;
  subjectName: string;
  average: number | null;
  countedGrades: number;
  excludedGrades: number;
  subjectCoefficient: number | null;
  source: 'computed';
};

export type OverallAverageResult = {
  value: number | null;
  outOf: 20;
  method: 'subject-coefficients' | 'equal-weights' | 'none';
  isEstimate: boolean;
  subjects: SubjectAverageResult[];
};

/**
 * Overall average.
 *
 * - when every subject has a coefficient, the weighted mean is used and is still
 *   labelled "computed" because the coefficients come from the bulletin;
 * - when coefficients are missing, subjects are weighted equally and the result is
 *   flagged as an estimate, since this is not how PRONOTE computes it.
 */
export function computeOverallAverage(inputs: SubjectAverageInput[]): OverallAverageResult {
  const subjects: SubjectAverageResult[] = inputs.map((input) => {
    const computed = computeGradesAverage(input.grades);
    return {
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      average: computed.value,
      countedGrades: computed.countedGrades,
      excludedGrades: computed.excludedGrades,
      subjectCoefficient: input.subjectCoefficient ?? null,
      source: 'computed',
    };
  });

  const withAverage = subjects.filter((subject) => subject.average !== null);
  if (withAverage.length === 0) {
    return { value: null, outOf: 20, method: 'none', isEstimate: true, subjects };
  }

  const allHaveCoefficient = withAverage.every(
    (subject) => subject.subjectCoefficient !== null && subject.subjectCoefficient > 0,
  );

  if (allHaveCoefficient) {
    const totalCoefficient = withAverage.reduce((total, subject) => total + (subject.subjectCoefficient as number), 0);
    const totalPoints = withAverage.reduce(
      (total, subject) => total + (subject.average as number) * (subject.subjectCoefficient as number),
      0,
    );
    return {
      value: round2(totalPoints / totalCoefficient),
      outOf: 20,
      method: 'subject-coefficients',
      isEstimate: false,
      subjects,
    };
  }

  const total = withAverage.reduce((sum, subject) => sum + (subject.average as number), 0);
  return {
    value: round2(total / withAverage.length),
    outOf: 20,
    method: 'equal-weights',
    isEstimate: true,
    subjects,
  };
}

export type SimulationInput = {
  currentGrades: Grade[];
  hypothetical: { points: number; outOf?: number; coefficient?: number };
};

export type SimulationResult = {
  currentAverage: number | null;
  simulatedAverage: number | null;
  delta: number | null;
  outOf: 20;
  isSimulation: true;
};

export function simulateGrade({ currentGrades, hypothetical }: SimulationInput): SimulationResult {
  const outOf = hypothetical.outOf ?? 20;
  const coefficient = hypothetical.coefficient ?? 1;
  if (!Number.isFinite(hypothetical.points) || hypothetical.points < 0 || hypothetical.points > outOf) {
    throw new Error(`La note simulée doit être comprise entre 0 et ${outOf}.`);
  }
  if (!Number.isFinite(coefficient) || coefficient <= 0 || coefficient > 100) {
    throw new Error('Le coefficient doit être un nombre strictement positif.');
  }

  const template = currentGrades[0];
  const simulated: Grade = {
    id: 'simulation',
    accountId: template?.accountId ?? '',
    nativeId: 'simulation',
    periodId: template?.periodId ?? null,
    subjectId: template?.subjectId ?? null,
    subjectName: template?.subjectName ?? 'Simulation',
    valuePoints: hypothetical.points,
    valueKind: 0,
    outOfPoints: outOf,
    coefficient,
    gradedAt: new Date().toISOString().slice(0, 10),
    classAverage: null,
    classMin: null,
    classMax: null,
    comment: '',
    commentOnGrade: null,
    isBonus: false,
    isOptional: false,
    isOutOf20: outOf === 20,
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  };

  const before = computeGradesAverage(currentGrades);
  const after = computeGradesAverage([...currentGrades, simulated]);
  return {
    currentAverage: before.value,
    simulatedAverage: after.value,
    delta: before.value !== null && after.value !== null ? round2(after.value - before.value) : null,
    outOf: 20,
    isSimulation: true,
  };
}

export type ProgressionPoint = { periodId: string; periodName: string; startDate: string; value: number | null };

export function buildProgression(
  points: { periodId: string; periodName: string; startDate: string; grades: Grade[] }[],
): ProgressionPoint[] {
  return [...points]
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    .map((point) => ({
      periodId: point.periodId,
      periodName: point.periodName,
      startDate: point.startDate,
      value: computeGradesAverage(point.grades).value,
    }));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatAverage(value: number | null, outOf = 20): string {
  if (value === null) return '—';
  return `${value.toFixed(2).replace('.', ',')}/${outOf}`;
}
