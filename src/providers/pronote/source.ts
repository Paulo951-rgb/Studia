import {
  account as pronoteAccount,
  assignmentsFromIntervals,
  createSessionHandle,
  discussionMessages,
  discussions as pronoteDiscussions,
  evaluations as pronoteEvaluations,
  gradebook,
  gradesOverview,
  loginCredentials,
  loginQrCode,
  loginToken,
  menus as pronoteMenus,
  news as pronoteNews,
  notebook,
  resourcesFromIntervals,
  instance as pronoteInstance,
  sessionInformation,
  timetableFromIntervals,
  type AccountKind as PronoteAccountKind,
  type Period,
  type SessionHandle,
  type TabLocation,
} from '@blockshub/pawnote-lts';
import type { Fetcher } from '@literate.ink/utilities';
import type { AccountKind, Absence, CanteenMenu, Discussion, Evaluation, Homework, Message, SchoolDocument, SchoolEvent, SchoolNewsItem, SchoolPeriod, StudentProfile, Subject, TimetableClass } from '@/core/domain/types';
import {
  mapAssignment,
  mapDiscussion,
  mapEvaluation,
  mapGradeBook,
  mapGradesOverview,
  mapHolidays,
  mapMessages,
  mapNews,
  mapNotebook,
  mapPeriod,
  mapResource,
  mapSubject,
  mapTestsAsEvents,
  mapTimetable,
  mapWeekMenu,
} from '@/core/pronote/mappers';
import type { SyncSource } from '@/core/sync/engine';
import { makeId } from '@/core/util/ids';

/**
 * PRONOTE adapter.
 *
 * Compatibility notes (verified against `@blockshub/pawnote-lts` 1.6.4, the
 * maintained fork used by Papillon on Expo SDK 58):
 * - the package has no Node built-in imports; its only dependencies are pako,
 *   node-forge and html-entities, all pure JavaScript;
 * - it never calls `fetch` itself: it takes a `Fetcher` (`createSessionHandle(fetcher)`),
 *   which is exactly the seam React Native needs;
 * - PRONOTE rejects requests whose User-Agent is not the mobile app one, so the
 *   fetcher below sends that header.
 */
export const PRONOTE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PRONOTE Mobile APP Version/2.0.11';

export const pronoteFetcher: Fetcher = async (options) => {
  const response = await fetch(options.url, {
    method: options.method,
    headers: { ...options.headers, 'User-Agent': PRONOTE_USER_AGENT },
    body: options.method !== 'GET' ? options.content : undefined,
    redirect: options.redirect,
  });
  const content = await response.text();
  return {
    content,
    status: response.status,
    get headers() {
      return response.headers;
    },
  };
};

export const PRONOTE_ACCOUNT_KINDS = { student: 6, parent: 7, teacher: 8 } as const;

export function toPronoteKind(kind: AccountKind): PronoteAccountKind {
  return (PRONOTE_ACCOUNT_KINDS[kind as keyof typeof PRONOTE_ACCOUNT_KINDS] ?? 6) as PronoteAccountKind;
}

export function fromPronoteKind(kind: number): AccountKind {
  if (kind === 7) return 'parent';
  if (kind === 8) return 'teacher';
  return 'student';
}

export type PasswordLogin = {
  method: 'password';
  url: string;
  username: string;
  password: string;
  kind: AccountKind;
  deviceUuid: string;
};

export type QrLogin = {
  method: 'qr';
  /** Decoded QR payload: `{ url, kind, username, token }`. */
  qr: { url: string; kind: number; username: string; token: string };
  pin: string;
  deviceUuid: string;
};

export type TokenLogin = {
  method: 'token';
  url: string;
  username: string;
  token: string;
  kind: AccountKind;
  deviceUuid: string;
};

export type LoginInput = PasswordLogin | QrLogin | TokenLogin;

export type LoginResult = {
  session: SessionHandle;
  token: string;
  username: string;
  accountKind: AccountKind;
  navigatorIdentifier: string;
  /** Present when PRONOTE requires the double-authentication challenge to be solved. */
  securityHandle: unknown | null;
};

export async function login(input: LoginInput): Promise<LoginResult> {
  const session = createSessionHandle(pronoteFetcher);

  if (input.method === 'password') {
    const refresh = await loginCredentials(session, {
      url: input.url,
      username: input.username,
      password: input.password,
      kind: toPronoteKind(input.kind),
      deviceUUID: input.deviceUuid,
    });
    return {
      session,
      token: refresh.token,
      username: refresh.username,
      accountKind: fromPronoteKind(refresh.kind),
      navigatorIdentifier: refresh.navigatorIdentifier,
      securityHandle: null,
    };
  }

  if (input.method === 'token') {
    const refresh = await loginToken(session, {
      url: input.url,
      username: input.username,
      token: input.token,
      kind: toPronoteKind(input.kind),
      deviceUUID: input.deviceUuid,
    });
    return {
      session,
      token: refresh.token,
      username: refresh.username,
      accountKind: fromPronoteKind(refresh.kind),
      navigatorIdentifier: refresh.navigatorIdentifier,
      securityHandle: null,
    };
  }

  const refresh = await loginQrCode(session, {
    deviceUUID: input.deviceUuid,
    pin: input.pin,
    qr: input.qr,
  });
  return {
    session,
    token: refresh.token,
    username: refresh.username,
    accountKind: fromPronoteKind(refresh.kind),
    navigatorIdentifier: refresh.navigatorIdentifier,
    securityHandle: null,
  };
}

/** Reads instance metadata without authenticating, used to validate a school URL. */
export async function describeInstance(url: string): Promise<{ name: string; version: number[]; accounts: { name: string; path: string }[]; casUrl: string | null }> {
  const info = await pronoteInstance(url, pronoteFetcher);
  return { name: info.name, version: info.version, accounts: info.accounts, casUrl: info.casURL ?? null };
}

/** Session renewal helper: `sessionInformation` is what Pawnote uses internally. */
export async function probeSession(options: {
  base: string;
  kind: PronoteAccountKind;
  params: Record<string, unknown>;
  cookies: string[];
}): Promise<{ version: number[] }> {
  const result = await sessionInformation(options, pronoteFetcher);
  return { version: result.version };
}

export class PronoteSource implements SyncSource {
  private periodsByDomainId = new Map<string, Period>();

  constructor(
    private readonly session: SessionHandle,
    private readonly accountId: string,
    private readonly options: { onSessionRenewed?: (() => Promise<void>) | undefined } = {},
  ) {
    this.indexPeriods();
  }

  private indexPeriods(): void {
    const tabs = this.session.userResource?.tabs;
    if (!tabs) return;
    for (const tab of tabs.values()) {
      for (const period of tab.periods ?? []) {
        this.periodsByDomainId.set(makeId('per', this.accountId, period.id), period);
      }
    }
  }

  private requirePeriod(domainPeriodId: string): Period {
    const period = this.periodsByDomainId.get(domainPeriodId);
    if (!period) {
      const error = new Error('Période inconnue dans la session PRONOTE');
      error.name = 'PageUnavailableError';
      throw error;
    }
    return period;
  }

  authorizedTabs(): number[] {
    return [...(this.session.user?.authorizations?.tabs ?? [])] as TabLocation[];
  }

  async fetchProfile(): Promise<StudentProfile> {
    const resource = this.session.userResource;
    const user = this.session.user;
    const at = new Date().toISOString();
    return {
      accountId: this.accountId,
      nativeId: user.id,
      name: user.name,
      kind: fromPronoteKind(user.kind),
      className: resource?.className ?? null,
      establishmentName: resource?.establishmentName ?? '',
      profilePictureUrl: resource?.profilePicture?.url ?? null,
      isDelegate: Boolean(resource?.isDelegate),
      isDirector: Boolean(resource?.isDirector),
      isMemberCa: Boolean(resource?.isMemberCA),
      updatedAt: at,
      syncedAt: at,
    };
  }

  async fetchPeriods(): Promise<{ periods: SchoolPeriod[]; defaultPeriodId: string | null }> {
    const at = new Date().toISOString();
    const seen = new Map<string, SchoolPeriod>();
    let defaultNativeId: string | null = null;

    const tabs = this.session.userResource?.tabs;
    if (tabs) {
      for (const tab of tabs.values()) {
        if (tab.defaultPeriod && !defaultNativeId) defaultNativeId = tab.defaultPeriod.id;
        for (const period of tab.periods ?? []) {
          const mapped = mapPeriod(this.accountId, period, false, at);
          seen.set(mapped.id, { ...mapped, isDefault: period.id === defaultNativeId });
        }
      }
    }
    if (seen.size === 0) {
      for (const period of this.session.instance?.periods ?? []) {
        const mapped = mapPeriod(this.accountId, period, false, at);
        seen.set(mapped.id, mapped);
      }
    }

    const periods = [...seen.values()].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    const fallback = periods[periods.length - 1];
    if (!defaultNativeId && fallback) {
      return { periods: periods.map((p) => ({ ...p, isDefault: p.id === fallback.id })), defaultPeriodId: fallback.id };
    }
    const defaultDomainId = defaultNativeId ? makeId('per', this.accountId, defaultNativeId) : null;
    return { periods: periods.map((p) => ({ ...p, isDefault: p.id === defaultDomainId })), defaultPeriodId: defaultDomainId };
  }

  /**
   * Subjects are only exposed through a period's grade overview. When the account
   * has no access to the grades tab, PRONOTE gives us nothing to list: we return an
   * empty array instead of inventing a subject list.
   */
  async fetchSubjects(): Promise<Subject[]> {
    if (!this.authorizedTabs().includes(198)) return [];
    const { periods } = await this.fetchPeriods();
    const period = periods.find((entry) => entry.isDefault) ?? periods[periods.length - 1];
    if (!period) return [];
    const overview = await gradesOverview(this.session, this.requirePeriod(period.id));
    return mapGradesOverview(this.accountId, period.id, overview).subjects;
  }

  async fetchGrades(periodId: string) {
    const period = this.requirePeriod(periodId);
    const overview = await gradesOverview(this.session, period);
    const mapped = mapGradesOverview(this.accountId, periodId, overview);
    return { grades: mapped.grades, averages: mapped.averages, subjects: mapped.subjects };
  }

  async fetchReportCard(periodId: string) {
    const period = this.requirePeriod(periodId);
    const book = await gradebook(this.session, period);
    return mapGradeBook(this.accountId, periodId, book);
  }

  async fetchEvaluations(periodId: string): Promise<Evaluation[]> {
    const period = this.requirePeriod(periodId);
    const items = await pronoteEvaluations(this.session, period);
    return items.map((evaluation) => mapEvaluation(this.accountId, periodId, evaluation));
  }

  async fetchHomework(from: string, to: string): Promise<Homework[]> {
    const assignments = await assignmentsFromIntervals(this.session, new Date(`${from}T00:00:00Z`), new Date(`${to}T23:59:59Z`));
    return assignments.map((assignment) => mapAssignment(this.accountId, assignment));
  }

  async fetchDiscussions(): Promise<Discussion[]> {
    const result = await pronoteDiscussions(this.session);
    const discussions: Discussion[] = [];
    for (const discussion of result.items) {
      let participants: string[] = [];
      if (discussion.creator) participants = [discussion.creator];
      discussions.push(mapDiscussion(this.accountId, discussion, participants));
    }
    return discussions;
  }

  async fetchMessages(discussionId: string): Promise<Message[]> {
    const result = await pronoteDiscussions(this.session);
    const target = result.items.find(
      (discussion) => makeId('dis', this.accountId, discussion.participantsMessageID || discussion.subject) === discussionId,
    );
    if (!target) return [];
    const messages = await discussionMessages(this.session, target);
    return mapMessages(this.accountId, discussionId, messages);
  }

  async fetchTimetable(from: string, to: string): Promise<TimetableClass[]> {
    const timetable = await timetableFromIntervals(this.session, new Date(`${from}T00:00:00Z`), new Date(`${to}T23:59:59Z`));
    return mapTimetable(this.accountId, timetable);
  }

  async fetchEvents(): Promise<SchoolEvent[]> {
    const holidays = mapHolidays(this.accountId, this.session.instance);
    const today = new Date();
    const inThreeWeeks = new Date(today.getTime() + 21 * 24 * 3600 * 1000);
    const timetable = await timetableFromIntervals(this.session, today, inThreeWeeks);
    const classes = mapTimetable(this.accountId, timetable);
    return [...holidays, ...mapTestsAsEvents(this.accountId, classes)];
  }

  async fetchAbsences(periodId: string): Promise<Absence[]> {
    const period = this.requirePeriod(periodId);
    const book = await notebook(this.session, period);
    return mapNotebook(this.accountId, book);
  }

  async fetchNews(): Promise<SchoolNewsItem[]> {
    const items = await pronoteNews(this.session);
    return mapNews(this.accountId, items);
  }

  async fetchCanteen(from: string, to: string): Promise<CanteenMenu[]> {
    const menus: CanteenMenu[] = [];
    const seen = new Set<string>();
    let cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      const week = await pronoteMenus(this.session, cursor);
      for (const menu of mapWeekMenu(this.accountId, week)) {
        if (!seen.has(menu.id) && menu.menuDate >= from && menu.menuDate <= to) {
          seen.add(menu.id);
          menus.push(menu);
        }
      }
      cursor = new Date(cursor.getTime() + 7 * 24 * 3600 * 1000);
    }
    return menus;
  }

  async fetchDocuments(from: string, to: string): Promise<SchoolDocument[]> {
    const resources = await resourcesFromIntervals(this.session, new Date(`${from}T00:00:00Z`), new Date(`${to}T23:59:59Z`));
    return resources.flatMap((resource) => mapResource(this.accountId, resource));
  }

  async fetchAccountDetails(): Promise<{ ine: string | null; email: string | null }> {
    const details = await pronoteAccount(this.session);
    return { ine: details.INE ?? null, email: details.email ?? null };
  }
}
