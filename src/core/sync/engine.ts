import type { Repositories } from '@/db';
import { mapPronoteError, type PronoteErrorCode } from '@/core/pronote/errors';
import { makeId } from '@/core/util/ids';
import type {
  Absence,
  CanteenMenu,
  Discussion,
  Evaluation,
  Homework,
  Message,
  SchoolDocument,
  SchoolEvent,
  SchoolNewsItem,
  SchoolPeriod,
  StudentProfile,
  Subject,
  SyncHistoryEntry,
  SyncRunKind,
  TimetableClass,
} from '@/core/domain/types';
import { computeOverallAverage } from '@/core/school/averages';

/**
 * What the sync engine needs from a connector. Implemented by the Pawnote adapter,
 * and by a fake source in tests.
 */
export type SyncSource = {
  fetchProfile(): Promise<StudentProfile>;
  fetchPeriods(): Promise<{ periods: SchoolPeriod[]; defaultPeriodId: string | null }>;
  fetchSubjects(): Promise<Subject[]>;
  fetchGrades(periodId: string): Promise<{ grades: unknown[]; averages: unknown[]; subjects: Subject[] }>;
  fetchReportCard(periodId: string): Promise<unknown | null>;
  fetchEvaluations(periodId: string): Promise<Evaluation[]>;
  fetchHomework(from: string, to: string): Promise<Homework[]>;
  fetchDiscussions(): Promise<Discussion[]>;
  fetchMessages(discussionId: string): Promise<Message[]>;
  fetchTimetable(from: string, to: string): Promise<TimetableClass[]>;
  fetchEvents(): Promise<SchoolEvent[]>;
  fetchAbsences(periodId: string): Promise<Absence[]>;
  fetchNews(): Promise<SchoolNewsItem[]>;
  fetchCanteen(from: string, to: string): Promise<CanteenMenu[]>;
  fetchDocuments(from: string, to: string): Promise<SchoolDocument[]>;
  /** PRONOTE tab authorisations, used to skip what the account cannot access. */
  authorizedTabs(): number[];
  /** Called when the connector had to re-authenticate. */
  onSessionRenewed?: (() => Promise<void>) | undefined;
};

export type SyncResource = 'profile' | 'periods' | 'grades' | 'report_cards' | 'evaluations' | 'homework' | 'messages' | 'timetable' | 'events' | 'absences' | 'news' | 'canteen' | 'documents';

export const SYNC_ORDER: SyncResource[] = [
  'profile',
  'periods',
  'grades',
  'report_cards',
  'evaluations',
  'homework',
  'messages',
  'timetable',
  'events',
  'absences',
  'news',
  'canteen',
  'documents',
];

export type ResourceReport = {
  status: 'ok' | 'error' | 'skipped';
  items: number;
  errorCode?: string;
  errorMessage?: string;
};

export type SyncSummary = {
  runId: string;
  kind: SyncRunKind;
  status: 'ok' | 'partial' | 'error' | 'aborted';
  startedAt: string;
  finishedAt: string;
  resources: Record<string, ResourceReport>;
  requests: number;
  errorCode: PronoteErrorCode | null;
  errorMessage: string | null;
  requiresReauth: boolean;
};

export type SyncOptions = {
  repos: Repositories;
  source: SyncSource;
  accountId: string;
  kind: SyncRunKind;
  now?: () => Date;
  onProgress?: (resource: SyncResource, report: ResourceReport) => void;
  signal?: AbortSignal;
  /** Hard cap on connector calls for one run, to avoid hammering the school server. */
  requestBudget?: number;
  /** Incremental windows, in days. */
  windows?: { pastDays: number; futureDays: number };
  /**
   * Restricts the run to these resources, used to retry what failed without
   * re-downloading everything. `profile` and `periods` are always included because
   * every other resource resolves its scope through them.
   */
  only?: SyncResource[];
};

class BudgetExceededError extends Error {
  override readonly name = 'BudgetExceededError';
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export async function runSync(options: SyncOptions): Promise<SyncSummary> {
  const { repos, source, accountId, kind, onProgress, signal } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const runId = makeId('sync', accountId, startedAt, Math.random().toString(36).slice(2, 8));
  const budget = options.requestBudget ?? (kind === 'initial' ? 120 : 30);
  const windows = options.windows ?? { pastDays: 14, futureDays: 21 };

  const resources: Record<string, ResourceReport> = {};
  let requests = 0;
  let firstErrorCode: PronoteErrorCode | null = null;
  let fatalMessage: string | null = null;
  let requiresReauth = false;
  let aborted = false;

  const tabs = new Set(source.authorizedTabs());

  const wanted: Set<SyncResource> | null = options.only
    ? new Set<SyncResource>([...options.only, 'profile', 'periods'])
    : null;

  let budgetExhausted = false;

  const consume = (): void => {
    if (budgetExhausted) throw new BudgetExceededError(`Budget de ${budget} requêtes dépassé`);
    requests += 1;
    if (requests > budget) {
      budgetExhausted = true;
      throw new BudgetExceededError(`Budget de ${budget} requêtes dépassé`);
    }
  };

  const record = (resource: SyncResource, report: ResourceReport): void => {
    // A budget stop or an explicit resource selection is final: later branches must
    // not overwrite it with "empty".
    if (
      resources[resource]?.errorCode === 'request_budget_exceeded' ||
      resources[resource]?.errorCode === 'not_requested'
    ) {
      return;
    }
    resources[resource] = report;
    onProgress?.(resource, report);
  };

  const guard = async <T>(resource: SyncResource, task: () => Promise<T>): Promise<T | null> => {
    if (wanted && !wanted.has(resource)) {
      record(resource, { status: 'skipped', items: 0, errorCode: 'not_requested' });
      return null;
    }
    if (signal?.aborted || aborted) {
      aborted = true;
      record(resource, { status: 'skipped', items: 0, errorCode: 'aborted' });
      return null;
    }
    try {
      return await task();
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        record(resource, { status: 'skipped', items: 0, errorCode: 'request_budget_exceeded' });
        aborted = true;
        return null;
      }
      const mapped = mapPronoteError(error);
      if (mapped.requiresReauth) requiresReauth = true;
      if (!firstErrorCode) firstErrorCode = mapped.code;
      record(resource, { status: 'error', items: 0, errorCode: mapped.code, errorMessage: mapped.message });
      await repos.sync.setCursor(accountId, resource, null, mapped.code);
      if (mapped.requiresReauth) throw error;
      return null;
    }
  };

  await repos.sync.startRun({
    id: runId,
    accountId,
    kind,
    startedAt,
    finishedAt: null,
    status: 'partial',
    resources,
    errorCode: null,
    errorMessage: null,
    durationMs: null,
  });

  try {
    const profile = await guard('profile', async () => {
      consume();
      return source.fetchProfile();
    });
    if (profile) {
      await repos.writer.saveProfile(profile);
      record('profile', { status: 'ok', items: 1 });
    }

    const periodsResult = await guard('periods', async () => {
      consume();
      return source.fetchPeriods();
    });
    let periods: SchoolPeriod[] = [];
    if (periodsResult) {
      periods = periodsResult.periods.map((period) => ({
        ...period,
        isDefault: period.id === periodsResult.defaultPeriodId,
      }));
      const stats = await repos.writer.savePeriods(accountId, periods, true);
      record('periods', { status: 'ok', items: periods.length + stats.removed });
    } else {
      periods = await repos.school.listPeriods(accountId);
    }

    const currentPeriod = periods.find((period) => period.isDefault) ?? periods[periods.length - 1];

    if (currentPeriod && tabs.has(198)) {
      const gradesResult = await guard('grades', async () => {
        consume();
        return source.fetchGrades(currentPeriod.id);
      });
      if (gradesResult) {
        // Subjects must exist before grades: grades reference subject_id.
        await repos.writer.saveSubjects(accountId, gradesResult.subjects);
        const stats = await repos.writer.saveGrades(
          accountId,
          currentPeriod.id,
          gradesResult.grades as never[],
          true,
        );
        await repos.writer.saveAverages(accountId, gradesResult.averages as never[]);
        record('grades', { status: 'ok', items: (gradesResult.grades as unknown[]).length + stats.removed });
      }
    } else {
      // Without the grades tab PRONOTE exposes no subject list; fall back to what the
      // connector can still provide, and mark the resource as skipped if it has none.
      const subjects = await guard('grades', async () => {
        consume();
        return source.fetchSubjects();
      });
      if (subjects && subjects.length > 0) {
        await repos.writer.saveSubjects(accountId, subjects);
        record('grades', { status: 'ok', items: subjects.length });
      } else {
        record('grades', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
      }
    }

    if (currentPeriod && tabs.has(13)) {
      const reportCard = await guard('report_cards', async () => {
        consume();
        return source.fetchReportCard(currentPeriod.id);
      });
      if (reportCard) {
        const mapped = reportCard as {
          reportCard: Parameters<Repositories['writer']['saveReportCard']>[1];
          subjects: Parameters<Repositories['writer']['saveReportCard']>[2];
          averages: Parameters<Repositories['writer']['saveAverages']>[1];
          subjectsCatalog: Subject[];
        };
        await repos.writer.saveReportCard(accountId, mapped.reportCard, mapped.subjects);
        await repos.writer.saveSubjects(accountId, mapped.subjectsCatalog);
        await repos.writer.saveAverages(accountId, mapped.averages);
        record('report_cards', { status: 'ok', items: mapped.subjects.length });
      } else {
        record('report_cards', { status: 'skipped', items: 0, errorCode: 'empty' });
      }
    } else {
      record('report_cards', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (currentPeriod && tabs.has(201)) {
      const evaluations = await guard('evaluations', async () => {
        consume();
        return source.fetchEvaluations(currentPeriod.id);
      });
      if (evaluations) {
        const stats = await repos.writer.saveEvaluations(accountId, evaluations, currentPeriod.id, true);
        record('evaluations', { status: 'ok', items: evaluations.length + stats.removed });
      }
    } else {
      record('evaluations', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(88)) {
      const from = isoDay(addDays(now(), -windows.pastDays));
      const to = isoDay(addDays(now(), windows.futureDays));
      const homework = await guard('homework', async () => {
        consume();
        return source.fetchHomework(from, to);
      });
      if (homework) {
        const stats = await repos.writer.saveHomework(accountId, homework, false);
        record('homework', { status: 'ok', items: homework.length + stats.removed });
        await repos.sync.setCursor(accountId, 'homework', to);
      }
    } else {
      record('homework', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(131)) {
      const discussions = await guard('messages', async () => {
        consume();
        return source.fetchDiscussions();
      });
      if (discussions) {
        // Read the stored counters before saving: a discussion whose counters did not
        // move has nothing new to download, which saves one request per thread.
        const stored = new Map(
          (await repos.school.listDiscussions(accountId, 200)).map((entry) => [entry.nativeId, entry]),
        );
        await repos.writer.saveDiscussions(accountId, discussions);
        const changed = discussions.filter((discussion) => {
          const previous = stored.get(discussion.nativeId);
          if (!previous) return true;
          return (
            previous.messageCount !== discussion.messageCount ||
            previous.unreadCount !== discussion.unreadCount ||
            previous.lastMessageAt !== discussion.lastMessageAt
          );
        });
        let total = 0;
        for (const discussion of changed.slice(0, 25)) {
          const messages = await guard('messages', async () => {
            consume();
            return source.fetchMessages(discussion.id);
          });
          if (!messages) break;
          await repos.writer.saveMessages(accountId, discussion.id, messages);
          total += messages.length;
        }
        record('messages', { status: 'ok', items: total });
      }
    } else {
      record('messages', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(16)) {
      const from = isoDay(addDays(now(), -7));
      const to = isoDay(addDays(now(), windows.futureDays));
      const timetable = await guard('timetable', async () => {
        consume();
        return source.fetchTimetable(from, to);
      });
      if (timetable) {
        const stats = await repos.writer.saveTimetable(accountId, timetable, from, to);
        record('timetable', { status: 'ok', items: timetable.length + stats.removed });
      }
    } else {
      record('timetable', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    const events = await guard('events', async () => {
      consume();
      return source.fetchEvents();
    });
    if (events) {
      const stats = await repos.writer.saveEvents(accountId, events);
      record('events', { status: 'ok', items: events.length + stats.removed });
    }

    if (currentPeriod && tabs.has(19)) {
      const absences = await guard('absences', async () => {
        consume();
        return source.fetchAbsences(currentPeriod.id);
      });
      if (absences) {
        const stats = await repos.writer.saveAbsences(accountId, absences, true);
        record('absences', { status: 'ok', items: absences.length + stats.removed });
      }
    } else {
      record('absences', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(8)) {
      const news = await guard('news', async () => {
        consume();
        return source.fetchNews();
      });
      if (news) {
        const stats = await repos.writer.saveNews(accountId, news);
        record('news', { status: 'ok', items: news.length + stats.removed });
      }
    } else {
      record('news', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(10)) {
      const from = isoDay(addDays(now(), -1));
      const to = isoDay(addDays(now(), 13));
      const menus = await guard('canteen', async () => {
        consume();
        return source.fetchCanteen(from, to);
      });
      if (menus) {
        const stats = await repos.writer.saveCanteenMenus(accountId, menus);
        record('canteen', { status: 'ok', items: menus.length + stats.removed });
      }
    } else {
      record('canteen', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    if (tabs.has(89)) {
      const from = isoDay(addDays(now(), -windows.pastDays));
      const to = isoDay(addDays(now(), windows.futureDays));
      const documents = await guard('documents', async () => {
        consume();
        return source.fetchDocuments(from, to);
      });
      if (documents) {
        const stats = await repos.writer.saveDocuments(accountId, documents, false);
        record('documents', { status: 'ok', items: documents.length + stats.removed });
      }
    } else {
      record('documents', { status: 'skipped', items: 0, errorCode: 'not_authorized_tab' });
    }

    await refreshComputedAverages(repos, accountId, periods);
  } catch (error) {
    const mapped = mapPronoteError(error);
    firstErrorCode = mapped.code;
    fatalMessage = error instanceof Error ? error.message : mapped.message;
    if (mapped.requiresReauth) requiresReauth = true;
  }

  const finishedAt = now().toISOString();
  const statuses = Object.values(resources);
  const hasError = statuses.some((report) => report.status === 'error');
  const allSkipped = statuses.length > 0 && statuses.every((report) => report.status === 'skipped');
  const status: SyncSummary['status'] = aborted ? 'aborted' : hasError ? (statuses.some((report) => report.status === 'ok') ? 'partial' : 'error') : allSkipped ? 'partial' : 'ok';

  const summary: SyncSummary = {
    runId,
    kind,
    status,
    startedAt,
    finishedAt,
    resources,
    requests,
    errorCode: firstErrorCode,
    errorMessage: fatalMessage,
    requiresReauth,
  };

  const historyEntry: SyncHistoryEntry = {
    id: runId,
    accountId,
    kind,
    startedAt,
    finishedAt,
    status,
    resources,
    errorCode: firstErrorCode,
    errorMessage: fatalMessage ?? Object.values(resources).find((report) => report.errorMessage)?.errorMessage ?? null,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  };
  await repos.sync.finishRun(historyEntry);

  if (status === 'ok' || status === 'partial') {
    await repos.accounts.markSynced(accountId, finishedAt);
  }
  if (requiresReauth) {
    await repos.accounts.setStatus(accountId, 'expired');
  }

  return summary;
}

/**
 * Recomputes "computed" averages locally from stored grades, keeping PRONOTE's own
 * averages untouched (they are stored with source = 'pronote').
 */
export async function refreshComputedAverages(repos: Repositories, accountId: string, periods: SchoolPeriod[]): Promise<void> {
  const subjects = await repos.school.listSubjects(accountId);
  const now = new Date().toISOString();

  for (const period of periods) {
    // One query per period instead of one per (period, subject) pair. The reader caps a
    // page at 500 rows, far above what a single period holds.
    const periodGrades = await repos.school.listGrades({ accountId, periodId: period.id, limit: 500 });
    if (periodGrades.length === 0) continue;
    const gradesBySubject = new Map<string, typeof periodGrades>();
    for (const grade of periodGrades) {
      if (!grade.subjectId) continue;
      const bucket = gradesBySubject.get(grade.subjectId);
      if (bucket) bucket.push(grade);
      else gradesBySubject.set(grade.subjectId, [grade]);
    }

    const inputs = [];
    for (const subject of subjects) {
      const grades = gradesBySubject.get(subject.id);
      if (!grades || grades.length === 0) continue;
      inputs.push({ subjectId: subject.id, subjectName: subject.name, grades, subjectCoefficient: null });
    }
    if (inputs.length === 0) continue;

    const overall = computeOverallAverage(inputs);
    const averages = overall.subjects
      .filter((subject) => subject.average !== null)
      .map((subject) => ({
        id: makeId('avg', accountId, period.id, subject.subjectId),
        accountId,
        periodId: period.id,
        subjectId: subject.subjectId,
        studentValue: subject.average,
        classValue: null,
        minValue: null,
        maxValue: null,
        outOf: 20,
        source: 'computed' as const,
        computedAt: now,
        syncedAt: now,
      }));

    const existing = await repos.school.listAverages({ accountId, periodId: period.id });
    const pronoteSubjectIds = new Set(existing.filter((entry) => entry.source === 'pronote').map((entry) => entry.subjectId));
    await repos.writer.saveAverages(
      accountId,
      averages.filter((entry) => !pronoteSubjectIds.has(entry.subjectId)),
    );
  }
}
