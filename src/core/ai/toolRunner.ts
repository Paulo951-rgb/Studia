import type { Repositories } from '@/db';
import type { SearchKind } from '@/db/repositories/search';
import type { Grade, SchoolPeriod, Subject } from '@/core/domain/types';
import { computeGradesAverage, computeOverallAverage, simulateGrade, formatAverage } from '@/core/school/averages';
import { TOOL_LIMITS, type ParsedToolArguments, type ToolName } from '@/core/ai/tools';

export type ToolResult =
  | { ok: true; data: string }
  | { ok: false; error: { code: string; message: string } };

const UNTRUSTED_OPEN = '<<<DONNEES_SCOLAIRES_NON_FIABLES>>>';
const UNTRUSTED_CLOSE = '<<<FIN_DONNEES_SCOLAIRES>>>';

/** Wraps PRONOTE-provided text so the model can never confuse it with instructions. */
export function fenceUntrusted(text: string): string {
  return `${UNTRUSTED_OPEN}\n${text}\n${UNTRUSTED_CLOSE}`;
}

export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolvePeriod(periods: SchoolPeriod[], wanted: string | null | undefined): SchoolPeriod | undefined {
  if (periods.length === 0) return undefined;
  if (wanted) {
    const target = normalizeLabel(wanted);
    const match = periods.find(
      (period) =>
        period.id === wanted ||
        period.nativeId === wanted ||
        normalizeLabel(period.name) === target ||
        normalizeLabel(period.name).includes(target),
    );
    if (match) return match;
  }
  return periods.find((period) => period.isDefault) ?? periods[periods.length - 1];
}

/**
 * Resolves a subject name typed by the model or the user.
 *
 * School abbreviations are common ("maths", "HG"), so a conservative matching is
 * applied. When several subjects match equally well the function returns
 * `undefined` rather than guessing: showing the wrong subject's grades would be
 * worse than asking for clarification.
 */
function resolveSubject(subjects: Subject[], wanted: string | null | undefined): Subject | undefined {
  if (!wanted) return undefined;
  const target = normalizeLabel(wanted);
  if (!target) return undefined;

  const direct =
    subjects.find((subject) => subject.id === wanted || subject.nativeId === wanted) ??
    subjects.find((subject) => normalizeLabel(subject.name) === target);
  if (direct) return direct;

  const initials = (value: string): string =>
    normalizeLabel(value)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((word) => word[0] ?? '')
      .join('');

  const candidates = subjects.filter((subject) => {
    const name = normalizeLabel(subject.name);
    if (name.startsWith(target) || target.startsWith(name)) return true;
    if (target.length >= 4 && name.slice(0, 4) === target.slice(0, 4)) return true;
    return target.length >= 2 && initials(subject.name) === target;
  });

  return candidates.length === 1 ? candidates[0] : undefined;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [tronqué]`;
}

function isoDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.length === 10 ? value : value.slice(0, 10);
}

export type ToolRunnerDependencies = {
  repos: Repositories;
  accountId: string;
  now?: () => Date;
};

export function createToolRunner({ repos, accountId, now = () => new Date() }: ToolRunnerDependencies) {
  async function loadContext() {
    const [periods, subjects] = await Promise.all([
      repos.school.listPeriods(accountId),
      repos.school.listSubjects(accountId),
    ]);
    return { periods, subjects };
  }

  async function gradesFor(period: SchoolPeriod | undefined, subject: Subject | undefined): Promise<Grade[]> {
    return repos.school.listGrades({
      accountId,
      ...(period ? { periodId: period.id } : {}),
      ...(subject ? { subjectId: subject.id } : {}),
      limit: 500,
    });
  }

  const handlers: Record<ToolName, (args: ParsedToolArguments) => Promise<unknown>> = {
    async get_student_profile() {
      const [profile, account] = await Promise.all([
        repos.school.getProfile(accountId),
        repos.accounts.get(accountId),
      ]);
      return {
        source: 'pronote (cache local)',
        last_sync_at: account?.lastSyncAt ?? null,
        profile: profile
          ? {
              name: profile.name,
              kind: profile.kind,
              class_name: profile.className,
              establishment: profile.establishmentName,
              is_delegate: profile.isDelegate,
              synced_at: profile.syncedAt,
            }
          : null,
        warning: profile ? undefined : "Aucun profil synchronisé : l'utilisateur doit se connecter à PRONOTE.",
      };
    },

    async get_grades(args) {
      const { periods, subjects } = await loadContext();
      const period = resolvePeriod(periods, args.period);
      const subject = resolveSubject(subjects, args.subject);
      const grades = await gradesFor(period, subject);
      const limit = args.limit ?? TOOL_LIMITS.maxResults;
      return {
        source: 'pronote (cache local)',
        period: period?.name ?? null,
        subject: subject?.name ?? null,
        count: grades.length,
        truncated: grades.length > limit,
        items: grades.slice(0, limit).map((grade) => ({
          id: grade.id,
          subject: grade.subjectName,
          date: grade.gradedAt,
          value: grade.valuePoints,
          out_of: grade.outOfPoints,
          coefficient: grade.coefficient,
          class_average: grade.classAverage,
          kind: grade.valueKind,
          comment: grade.comment ? fenceUntrusted(clip(grade.comment, 400)) : null,
          comment_on_grade: grade.commentOnGrade ? fenceUntrusted(clip(grade.commentOnGrade, 400)) : null,
        })),
      };
    },

    async get_averages(args) {
      const { periods } = await loadContext();
      const period = resolvePeriod(periods, args.period);
      if (!period) return { source: 'local', averages: [], warning: 'Aucune période synchronisée.' };
      const averages = await repos.school.listAverages({ accountId, periodId: period.id });
      const subjects = await repos.school.listSubjects(accountId);
      const byId = new Map(subjects.map((subject) => [subject.id, subject.name]));
      return {
        source: 'pronote (cache local)',
        period: period.name,
        averages: averages.map((average) => ({
          subject: average.subjectId ? (byId.get(average.subjectId) ?? 'Matière inconnue') : 'Moyenne générale',
          student: average.studentValue,
          class: average.classValue,
          min: average.minValue,
          max: average.maxValue,
          out_of: average.outOf,
          origin: average.source,
          synced_at: average.syncedAt,
        })),
        note: "origin='pronote' = moyenne calculée par PRONOTE ; origin='computed' = recalcul local à partir des notes et coefficients.",
      };
    },

    async get_report_cards(args) {
      const { periods } = await loadContext();
      const period = resolvePeriod(periods, args.period);
      const cards = await repos.school.listReportCards(accountId, period?.id);
      return {
        source: 'pronote (cache local)',
        count: cards.length,
        report_cards: cards.map((card) => ({
          period: periods.find((entry) => entry.id === card.periodId)?.name ?? card.periodId,
          general_comment: card.generalComment ? fenceUntrusted(card.generalComment) : null,
          assessments: card.overallAssessments,
          subjects: card.subjects.map((subject) => ({
            subject: subject.subjectName,
            coefficient: subject.coefficient,
            average: subject.studentAverage,
            class_average: subject.classAverage,
            teachers: subject.teachers,
            assessments: subject.assessments.map((assessment) => fenceUntrusted(assessment)),
          })),
          synced_at: card.syncedAt,
        })),
        warning: cards.length === 0 ? 'Aucun bulletin enregistré pour cette période.' : undefined,
      };
    },

    async search_messages(args) {
      const hits = await repos.search.search({
        query: args.query ?? '',
        accountId,
        kinds: ['message'],
        limit: args.limit ?? 10,
      });
      const details = [];
      for (const hit of hits) {
        const messages = await repos.school.listMessages({ accountId, limit: 500 });
        const message = messages.find((entry) => entry.id === hit.refId);
        if (!message) continue;
        details.push({
          message_id: message.id,
          author: message.authorName,
          sent_at: message.sentAt,
          excerpt: fenceUntrusted(clip(message.contentText, 400)),
          has_attachments: message.attachments.length > 0,
        });
      }
      return {
        source: 'pronote (cache local, FTS5)',
        query: args.query,
        count: details.length,
        messages: details,
      };
    },

    async get_message_details(args) {
      const messages = await repos.school.listMessages({ accountId, limit: 500 });
      const message = messages.find((entry) => entry.id === args.message_id);
      if (!message) return { error: 'message_not_found', message: 'Message inconnu dans le cache local.' };
      return {
        source: 'pronote (cache local)',
        message: {
          message_id: message.id,
          author: message.authorName,
          sent_at: message.sentAt,
          content: fenceUntrusted(clip(message.contentText, TOOL_LIMITS.maxDocumentChars)),
          attachments: message.attachments.map((attachment) => ({ name: attachment.name, url: attachment.url })),
        },
      };
    },

    async search_teacher_feedback(args) {
      const { subjects } = await loadContext();
      const subject = resolveSubject(subjects, args.subject);
      if (args.query) {
        const hits = await repos.search.search({
          query: args.query,
          accountId,
          kinds: ['grade_comment', 'report_card', 'evaluation'],
          limit: args.limit ?? 10,
        });
        return {
          source: 'pronote (cache local, FTS5)',
          query: args.query,
          count: hits.length,
          results: hits.map((hit) => ({
            kind: hit.kind,
            ref_id: hit.refId,
            title: hit.title,
            excerpt: fenceUntrusted(hit.snippet),
          })),
        };
      }

      const [grades, cards, evaluations] = await Promise.all([
        gradesFor(undefined, subject),
        repos.school.listReportCards(accountId),
        repos.school.listEvaluations({ accountId, limit: 30 }),
      ]);

      const gradeComments = grades
        .filter((grade) => grade.comment || grade.commentOnGrade)
        .slice(0, args.limit ?? 15)
        .map((grade) => ({
          kind: 'grade_comment',
          subject: grade.subjectName,
          date: grade.gradedAt,
          text: fenceUntrusted([grade.comment, grade.commentOnGrade].filter(Boolean).join(' — ')),
        }));

      const reportComments = cards
        .flatMap((card) =>
          card.subjects
            .filter((entry) => entry.assessments.length > 0)
            .map((entry) => ({
              kind: 'report_card',
              subject: entry.subjectName,
              date: card.syncedAt.slice(0, 10),
              text: fenceUntrusted(entry.assessments.join(' ')),
            })),
        )
        .slice(0, 15);

      const evaluationDescriptions = evaluations
        .filter((evaluation) => evaluation.description)
        .slice(0, 10)
        .map((evaluation) => ({
          kind: 'evaluation',
          subject: evaluation.subjectName,
          date: evaluation.evaluatedAt,
          text: fenceUntrusted(evaluation.description),
        }));

      return {
        source: 'pronote (cache local)',
        count: gradeComments.length + reportComments.length + evaluationDescriptions.length,
        results: [...gradeComments, ...reportComments, ...evaluationDescriptions],
      };
    },

    async get_homework(args) {
      const { subjects } = await loadContext();
      const subject = resolveSubject(subjects, args.subject);
      const homework = await repos.school.listHomework({
        accountId,
        ...(subject ? { subjectId: subject.id } : {}),
        includeDone: args.include_done ?? false,
        ...(isoDay(args.from) ? { from: `${isoDay(args.from)}T00:00:00.000Z` } : {}),
        ...(isoDay(args.to) ? { to: `${isoDay(args.to)}T23:59:59.999Z` } : {}),
        limit: args.limit ?? TOOL_LIMITS.maxResults,
      });
      return {
        source: 'pronote (cache local)',
        count: homework.length,
        items: homework.map((item) => ({
          id: item.id,
          subject: item.subjectName,
          deadline: item.deadline,
          done: item.done,
          estimated_minutes: item.estimatedMinutes,
          description: fenceUntrusted(clip(item.description, 800)),
          attachments: item.attachments.map((attachment) => attachment.name),
        })),
      };
    },

    async search_documents(args) {
      const hits = await repos.search.search({
        query: args.query ?? '',
        accountId,
        kinds: ['document'],
        limit: args.limit ?? 10,
      });
      return {
        source: 'pronote (cache local, FTS5)',
        query: args.query,
        count: hits.length,
        documents: hits.map((hit) => ({
          document_id: hit.refId,
          title: hit.title,
          excerpt: fenceUntrusted(hit.snippet),
        })),
      };
    },

    async read_document(args) {
      const document = await repos.school.getDocument(args.document_id ?? '');
      if (!document) return { error: 'document_not_found', message: 'Document inconnu dans le cache local.' };
      const attachments = await repos.school.listAttachments('document', document.id);
      return {
        source: 'pronote (cache local)',
        document: {
          document_id: document.id,
          title: document.title,
          subject: document.subjectName,
          category: document.category,
          date: document.startsAt,
          description: fenceUntrusted(clip(document.descriptionText, TOOL_LIMITS.maxDocumentChars)),
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            url: attachment.url,
            downloaded: Boolean(attachment.localPath),
          })),
        },
        limitation:
          "Le texte interne des PDF et documents bureautiques n'est pas fourni par PRONOTE ; seuls le titre, la description et le lien sont disponibles.",
      };
    },

    async get_timetable(args) {
      const classes = await repos.school.listTimetable({
        accountId,
        ...(args.from ? { from: args.from } : {}),
        ...(args.to ? { to: args.to } : {}),
        limit: args.limit ?? TOOL_LIMITS.maxResults,
      });
      return {
        source: 'pronote (cache local)',
        count: classes.length,
        classes: classes.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          subject: entry.subjectName,
          title: entry.title,
          starts_at: entry.startsAt,
          ends_at: entry.endsAt,
          canceled: entry.canceled,
          is_test: entry.isTest,
          status: entry.status,
          teachers: entry.teachers,
          rooms: entry.rooms,
        })),
      };
    },

    async get_events(args) {
      const events = await repos.school.listEvents({
        accountId,
        ...(args.from ? { from: args.from } : {}),
        ...(args.to ? { to: args.to } : {}),
        limit: args.limit ?? TOOL_LIMITS.maxResults,
      });
      return {
        source: 'pronote (vacances et contrôles dérivés)',
        count: events.length,
        events: events.map((event) => ({
          title: event.title,
          kind: event.kind,
          starts_at: event.startsAt,
          ends_at: event.endsAt,
          source: event.source,
          description: event.description ? fenceUntrusted(event.description) : null,
        })),
      };
    },

    async get_absences(args) {
      const absences = await repos.school.listAbsences({
        accountId,
        ...(args.from ? { from: args.from } : {}),
        ...(args.to ? { to: args.to } : {}),
        limit: args.limit ?? TOOL_LIMITS.maxResults,
      });
      return {
        source: 'pronote (cache local)',
        count: absences.length,
        absences: absences.map((absence) => ({
          kind: absence.kind,
          starts_at: absence.startsAt,
          ends_at: absence.endsAt,
          minutes: absence.minutes,
          days_missed: absence.daysMissed,
          justified: absence.justified,
          reason: absence.reason ? fenceUntrusted(absence.reason) : null,
        })),
      };
    },

    async get_canteen_menu(args) {
      const menus = await repos.school.listCanteenMenus({
        accountId,
        ...(args.from ? { from: args.from } : {}),
        ...(args.to ? { to: args.to } : {}),
        limit: args.limit ?? 10,
      });
      return {
        source: 'pronote (cache local)',
        count: menus.length,
        menus: menus.map((menu) => ({
          date: menu.menuDate,
          meal: menu.meal,
          courses: menu.courses.map((course) => ({
            section: course.section,
            items: course.items.map((item) => ({
              name: fenceUntrusted(item.name),
              allergens: item.allergens,
            })),
          })),
          allergens: menu.allergens,
        })),
        warning: menus.length === 0 ? "Aucun menu enregistré : la restauration n'est peut-être pas activée sur l'établissement." : undefined,
      };
    },

    async get_school_news(args) {
      const news = await repos.school.listNews({
        accountId,
        limit: args.limit ?? 10,
        unreadOnly: args.unread_only ?? false,
      });
      return {
        source: 'pronote (cache local)',
        count: news.length,
        news: news.map((item) => ({
          id: item.id,
          title: fenceUntrusted(item.title),
          category: item.category,
          author: item.author,
          published_at: item.publishedAt,
          read: item.isRead,
          is_survey: item.isSurvey,
          body: item.bodyText ? fenceUntrusted(clip(item.bodyText, 1200)) : null,
        })),
      };
    },

    async calculate_average(args) {
      const { periods, subjects } = await loadContext();
      const period = resolvePeriod(periods, args.period);
      const subject = resolveSubject(subjects, args.subject);

      if (subject) {
        const grades = await gradesFor(period, subject);
        const computed = computeGradesAverage(grades);
        return {
          type: 'calcul_exact',
          source: 'notes et coefficients enregistrés',
          period: period?.name ?? null,
          subject: subject.name,
          average: computed.value,
          formatted: formatAverage(computed.value),
          counted_grades: computed.countedGrades,
          excluded_grades: computed.excludedGrades,
          method: 'moyenne pondérée par les coefficients, notes bonus plafonnées à +0, notes facultatives retenues seulement si elles augmentent la moyenne',
          disclaimer: "Calcul local : il peut différer de l'arrondi officiel de PRONOTE.",
        };
      }

      const allSubjects = await repos.school.listSubjects(accountId);
      const inputs = [];
      for (const entry of allSubjects) {
        inputs.push({
          subjectId: entry.id,
          subjectName: entry.name,
          grades: await gradesFor(period, entry),
          subjectCoefficient: null,
        });
      }
      const overall = computeOverallAverage(inputs);
      return {
        type: overall.isEstimate ? 'estimation' : 'calcul_exact',
        source: 'notes et coefficients enregistrés',
        period: period?.name ?? null,
        average: overall.value,
        formatted: formatAverage(overall.value),
        method: overall.method,
        is_estimate: overall.isEstimate,
        subjects: overall.subjects.map((entry) => ({
          subject: entry.subjectName,
          average: entry.average,
          counted_grades: entry.countedGrades,
        })),
        disclaimer: overall.isEstimate
          ? 'Les coefficients par matière ne sont pas connus : les matières sont pondérées à égalité, ce qui est une estimation.'
          : 'Calcul local à partir des coefficients de matière disponibles.',
      };
    },

    async simulate_grade(args) {
      const { periods, subjects } = await loadContext();
      const subject = resolveSubject(subjects, args.subject);
      if (!subject) {
        return { error: 'subject_not_found', message: `Matière inconnue : ${args.subject}` };
      }
      const period = resolvePeriod(periods, args.period);
      const grades = await gradesFor(period, subject);
      const simulation = simulateGrade({
        currentGrades: grades,
        hypothetical: {
          points: args.points ?? 0,
          ...(args.out_of !== null && args.out_of !== undefined ? { outOf: args.out_of } : {}),
          ...(args.coefficient !== null && args.coefficient !== undefined ? { coefficient: args.coefficient } : {}),
        },
      });
      return {
        type: 'simulation',
        subject: subject.name,
        period: period?.name ?? null,
        current_average: simulation.currentAverage,
        simulated_average: simulation.simulatedAverage,
        delta: simulation.delta,
        disclaimer:
          "Simulation locale : ce n'est pas une note réelle, ni une prévision officielle. Elle suppose que la note compte avec le coefficient indiqué.",
      };
    },

    async get_school_summary() {
      const [profile, counts, latestSync, homework, unreadNews] = await Promise.all([
        repos.school.getProfile(accountId),
        repos.school.counts(accountId),
        repos.school.latestSync(accountId),
        repos.school.listHomework({ accountId, from: now().toISOString(), limit: 10 }),
        repos.school.listNews({ accountId, limit: 5, unreadOnly: true }),
      ]);
      const discussions = await repos.school.listDiscussions(accountId, 20);
      const unreadMessages = discussions.reduce((total, discussion) => total + discussion.unreadCount, 0);
      return {
        source: 'cache local',
        student: profile ? { name: profile.name, class_name: profile.className, establishment: profile.establishmentName } : null,
        counts,
        upcoming_homework: homework.map((item) => ({
          subject: item.subjectName,
          deadline: item.deadline,
          done: item.done,
          description: fenceUntrusted(clip(item.description, 200)),
        })),
        unread_messages: unreadMessages,
        unread_news: unreadNews.length,
        last_sync: latestSync
          ? { at: latestSync.finishedAt ?? latestSync.startedAt, status: latestSync.status, kind: latestSync.kind }
          : null,
      };
    },

    async search_school_history(args) {
      const kinds = (args.kinds as SearchKind[] | null | undefined) ?? undefined;
      const hits = await repos.search.search({
        query: args.query ?? '',
        accountId,
        ...(kinds ? { kinds } : {}),
        limit: args.limit ?? 10,
      });
      return {
        source: 'cache local (FTS5)',
        query: args.query,
        count: hits.length,
        results: hits.map((hit) => ({
          kind: hit.kind,
          ref_id: hit.refId,
          title: hit.title,
          excerpt: fenceUntrusted(hit.snippet),
        })),
      };
    },
  };

  return {
    async run(name: ToolName, args: ParsedToolArguments): Promise<ToolResult> {
      const handler = handlers[name];
      if (!handler) {
        return { ok: false, error: { code: 'TOOL_UNKNOWN', message: `Outil inconnu : ${name}` } };
      }
      try {
        const data = await handler(args);
        const serialized = JSON.stringify(data);
        return {
          ok: true,
          data: serialized.length > TOOL_LIMITS.maxToolOutputChars
            ? `${serialized.slice(0, TOOL_LIMITS.maxToolOutputChars)}… [sortie tronquée]`
            : serialized,
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'TOOL_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : 'Erreur inconnue',
          },
        };
      }
    },
  };
}

export type ToolRunner = ReturnType<typeof createToolRunner>;
