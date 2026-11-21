import type { Evaluation, Grade, SchoolPeriod, Subject, TimetableClass } from '@/core/domain/types';
import { normaliseGrade, round2 } from '@/core/school/averages';

/**
 * Derived school views used by the assistant.
 *
 * Every value here is computed from stored data with the same grade rules as
 * `averages.ts`. Nothing is a prediction: `requiredGradeForTarget` answers "what mark
 * would be needed", which is arithmetic, not an estimate of what will happen.
 */

export type UpcomingTest = {
  subject: string;
  title: string;
  date: string;
  source: 'evaluation' | 'timetable';
  coefficient: number | null;
  teacher: string | null;
};

export function upcomingTests(
  evaluations: Evaluation[],
  timetable: TimetableClass[],
  now: Date,
  days: number,
): UpcomingTest[] {
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const isUpcoming = (value: string): boolean => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= now.getTime() && time <= horizon.getTime();
  };

  const fromEvaluations: UpcomingTest[] = evaluations
    .filter((evaluation) => isUpcoming(evaluation.evaluatedAt))
    .map((evaluation) => ({
      subject: evaluation.subjectName,
      title: evaluation.name,
      date: evaluation.evaluatedAt,
      source: 'evaluation' as const,
      coefficient: evaluation.coefficient,
      teacher: evaluation.teacher,
    }));

  const fromTimetable: UpcomingTest[] = timetable
    .filter((entry) => entry.isTest && !entry.canceled && isUpcoming(entry.startsAt))
    .map((entry) => ({
      subject: entry.subjectName ?? entry.title,
      title: entry.title,
      date: entry.startsAt,
      source: 'timetable' as const,
      coefficient: null,
      teacher: entry.teachers[0] ?? null,
    }));

  return [...fromEvaluations, ...fromTimetable].sort((a, b) => a.date.localeCompare(b.date));
}

export type SubjectProgressPoint = { period: string; value: number; source: string };

export type SubjectProgress = {
  subject: string;
  points: SubjectProgressPoint[];
  /** Difference between the two most recent periods that carry a value. */
  delta: number | null;
  trend: 'up' | 'down' | 'stable' | 'unknown';
};

export function subjectProgress(
  subjects: Subject[],
  periods: SchoolPeriod[],
  averages: { subjectId: string | null; periodId: string; studentValue: number | null; source: string }[],
): SubjectProgress[] {
  const periodOrder = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const periodName = new Map(periodOrder.map((period) => [period.id, period.name]));

  const rows: SubjectProgress[] = [];
  for (const subject of subjects) {
    const points: SubjectProgressPoint[] = [];
    for (const period of periodOrder) {
      const candidates = averages.filter(
        (entry) => entry.subjectId === subject.id && entry.periodId === period.id && entry.studentValue !== null,
      );
      if (candidates.length === 0) continue;
      // PRONOTE's own average wins over the locally recomputed one for the same period.
      const chosen = candidates.find((entry) => entry.source === 'pronote') ?? candidates[0];
      if (!chosen || chosen.studentValue === null) continue;
      points.push({ period: periodName.get(period.id) ?? period.id, value: chosen.studentValue, source: chosen.source });
    }
    if (points.length === 0) continue;

    const last = points[points.length - 1]?.value ?? null;
    const previous = points[points.length - 2]?.value ?? null;
    const delta = last !== null && previous !== null ? round2(last - previous) : null;
    rows.push({
      subject: subject.name,
      points,
      delta,
      trend: delta === null ? 'unknown' : delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable',
    });
  }
  return rows;
}

export type TargetGradeResult = {
  currentAverage: number | null;
  countedGrades: number;
  needed: number | null;
  status: 'reached' | 'possible' | 'impossible' | 'no_data';
};

/**
 * Mark needed on one new graded assignment, of the given coefficient, to reach `target`.
 * Bonus and optional grades are left out: their rules differ and would make the answer
 * look more precise than it is.
 */
export function requiredGradeForTarget(grades: Grade[], target: number, coefficient: number): TargetGradeResult {
  const regular = grades
    .map(normaliseGrade)
    .filter((entry) => entry.counts && !entry.grade.isBonus && !entry.grade.isOptional && entry.coefficient > 0);

  if (regular.length === 0) {
    return { currentAverage: null, countedGrades: 0, needed: null, status: 'no_data' };
  }

  const coefficientSum = regular.reduce((total, entry) => total + entry.coefficient, 0);
  const pointsSum = regular.reduce((total, entry) => total + entry.points20 * entry.coefficient, 0);
  const currentAverage = round2(pointsSum / coefficientSum);
  const needed = round2((target * (coefficientSum + coefficient) - pointsSum) / coefficient);

  if (needed > 20) {
    return { currentAverage, countedGrades: regular.length, needed, status: 'impossible' };
  }
  if (needed <= 0) {
    return { currentAverage, countedGrades: regular.length, needed: 0, status: 'reached' };
  }
  return { currentAverage, countedGrades: regular.length, needed, status: 'possible' };
}

export type WeakSubject = { subject: string; average: number; gapToOverall: number; worstGrade: string | null };

export function weakSubjects(
  rows: { subject: string; average: number; worstGrade?: string | null }[],
  overall: number | null,
  threshold: number,
  limit: number,
): WeakSubject[] {
  if (overall === null) return [];
  return rows
    .map((row) => ({
      subject: row.subject,
      average: row.average,
      gapToOverall: round2(row.average - overall),
      worstGrade: row.worstGrade ?? null,
    }))
    .filter((row) => row.average < overall - threshold)
    .sort((a, b) => a.average - b.average)
    .slice(0, limit);
}
