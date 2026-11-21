import type {
  Assignment,
  Discussion,
  DiscussionMessages,
  Evaluation,
  Grade,
  GradesOverview,
  Holiday,
  InstanceParameters,
  News,
  Notebook,
  Period,
  Resource,
  Subject as PronoteSubject,
  Timetable,
  TimetableClass,
  TimetableClassActivity,
  TimetableClassDetention,
  TimetableClassLesson,
  WeekMenu,
} from '@blockshub/pawnote-lts';

/** Structural copy of Pawnote's `GradeBook` (not exported by the package). */
type PronoteGradeBook = Readonly<{
  message?: string;
  overallAssessments: { name: string; value: string }[];
  graph?: string;
  subjects: {
    subject: PronoteSubject;
    subjectGroup: string;
    coef: number;
    averages: { student: number; classOverall: number; max: number; min: number };
    assessments: string[];
    teachers: string[];
  }[];
  url: string;
}>;

type AnyTimetableClass = TimetableClassLesson | TimetableClassActivity | TimetableClassDetention;
import { makeId } from '@/core/util/ids';
import { htmlToText } from '@/core/util/html';
import type {
  Absence,
  Average,
  CanteenCourse,
  CanteenMenu,
  Discussion as DomainDiscussion,
  Evaluation as DomainEvaluation,
  Grade as DomainGrade,
  Homework,
  Message,
  ReportCard,
  ReportCardSubject,
  SchoolDocument,
  SchoolEvent,
  SchoolNewsItem,
  SchoolPeriod,
  Subject,
  TimetableClass as DomainTimetableClass,
} from '@/core/domain/types';

/**
 * Pure mapping from Pawnote DTOs to the local domain model.
 *
 * Nothing here performs I/O, which is what makes the connector testable: fixtures
 * are mapped and asserted without a PRONOTE server.
 */

const iso = (date: Date): string => new Date(date.getTime()).toISOString();
const isoDate = (date: Date): string => iso(date).slice(0, 10);

export function mapSubject(accountId: string, subject: PronoteSubject, at = new Date().toISOString()): Subject {
  return {
    id: makeId('sub', accountId, subject.id),
    accountId,
    nativeId: subject.id,
    name: subject.name,
    inGroups: subject.inGroups,
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapPeriod(accountId: string, period: Period, isDefault: boolean, at = new Date().toISOString()): SchoolPeriod {
  return {
    id: makeId('per', accountId, period.id),
    accountId,
    nativeId: period.id,
    name: period.name,
    kind: period.kind,
    startDate: isoDate(period.startDate),
    endDate: isoDate(period.endDate),
    isDefault,
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapGrade(accountId: string, periodId: string | null, grade: Grade, at = new Date().toISOString()): DomainGrade {
  return {
    id: makeId('gra', accountId, grade.id),
    accountId,
    nativeId: grade.id,
    periodId,
    subjectId: grade.subject ? makeId('sub', accountId, grade.subject.id) : null,
    subjectName: grade.subject?.name ?? 'Matière inconnue',
    valuePoints: grade.value?.points ?? null,
    valueKind: grade.value?.kind ?? 0,
    outOfPoints: grade.outOf?.points ?? null,
    coefficient: grade.coefficient,
    gradedAt: isoDate(grade.date),
    classAverage: grade.average?.points ?? null,
    classMin: grade.min?.points ?? null,
    classMax: grade.max?.points ?? null,
    comment: grade.comment ?? '',
    commentOnGrade: grade.commentaireSurNote ?? null,
    isBonus: grade.isBonus,
    isOptional: grade.isOptional,
    isOutOf20: grade.isOutOf20,
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapGradesOverview(
  accountId: string,
  periodId: string,
  overview: GradesOverview,
  at = new Date().toISOString(),
): { grades: DomainGrade[]; averages: Average[]; subjects: Subject[] } {
  const grades = overview.grades.map((grade) => mapGrade(accountId, periodId, grade, at));
  const subjects = new Map<string, Subject>();
  for (const grade of overview.grades) {
    if (grade.subject) subjects.set(grade.subject.id, mapSubject(accountId, grade.subject, at));
  }

  const averages: Average[] = [];
  for (const subjectAverage of overview.subjectsAverages) {
    const subjectId = makeId('sub', accountId, subjectAverage.subject.id);
    subjects.set(subjectAverage.subject.id, mapSubject(accountId, subjectAverage.subject, at));
    averages.push({
      id: makeId('avg', accountId, periodId, subjectId),
      accountId,
      periodId,
      subjectId,
      studentValue: subjectAverage.student?.points ?? null,
      classValue: subjectAverage.class_average?.points ?? null,
      minValue: subjectAverage.min?.points ?? null,
      maxValue: subjectAverage.max?.points ?? null,
      outOf: subjectAverage.outOf?.points ?? 20,
      source: 'pronote',
      computedAt: at,
      syncedAt: at,
    });
  }

  averages.push({
    id: makeId('avg', accountId, periodId, 'overall'),
    accountId,
    periodId,
    subjectId: null,
    studentValue: overview.overallAverage?.points ?? null,
    classValue: overview.classAverage?.points ?? null,
    minValue: null,
    maxValue: null,
    outOf: 20,
    source: 'pronote',
    computedAt: at,
    syncedAt: at,
  });

  return { grades, averages, subjects: [...subjects.values()] };
}

export function mapGradeBook(
  accountId: string,
  periodId: string,
  gradebook: PronoteGradeBook,
  at = new Date().toISOString(),
): { reportCard: ReportCard; subjects: ReportCardSubject[]; averages: Average[]; subjectsCatalog: Subject[] } {
  const reportCardId = makeId('rc', accountId, periodId);
  const reportCard: ReportCard = {
    id: reportCardId,
    accountId,
    periodId,
    generalComment: gradebook.message ?? null,
    overallAssessments: gradebook.overallAssessments.map((assessment: { name: string; value: string }) => ({
      name: assessment.name,
      value: assessment.value,
    })),
    sourceUrl: gradebook.url ?? null,
    updatedAt: at,
    syncedAt: at,
  };

  const subjects: ReportCardSubject[] = [];
  const averages: Average[] = [];
  const subjectsCatalog: Subject[] = [];

  for (const entry of gradebook.subjects) {
    const subjectId = makeId('sub', accountId, entry.subject.id);
    subjectsCatalog.push(mapSubject(accountId, entry.subject, at));
    subjects.push({
      id: makeId('rcs', reportCardId, entry.subject.name),
      reportCardId,
      accountId,
      subjectId,
      subjectName: entry.subject.name,
      subjectGroup: entry.subjectGroup ?? '',
      coefficient: entry.coef ?? 1,
      studentAverage: entry.averages?.student ?? null,
      classAverage: entry.averages?.classOverall ?? null,
      minValue: entry.averages?.min ?? null,
      maxValue: entry.averages?.max ?? null,
      teachers: entry.teachers ?? [],
      assessments: entry.assessments ?? [],
      updatedAt: at,
    });
    averages.push({
      id: makeId('avg', accountId, periodId, subjectId),
      accountId,
      periodId,
      subjectId,
      studentValue: entry.averages?.student ?? null,
      classValue: entry.averages?.classOverall ?? null,
      minValue: entry.averages?.min ?? null,
      maxValue: entry.averages?.max ?? null,
      outOf: 20,
      source: 'pronote',
      computedAt: at,
      syncedAt: at,
    });
  }

  return { reportCard, subjects, averages, subjectsCatalog };
}

export function mapEvaluation(accountId: string, periodId: string | null, evaluation: Evaluation, at = new Date().toISOString()): DomainEvaluation {
  return {
    id: makeId('eva', accountId, evaluation.id),
    accountId,
    nativeId: evaluation.id,
    periodId,
    subjectId: makeId('sub', accountId, evaluation.subject.id),
    subjectName: evaluation.subject.name,
    name: evaluation.name,
    teacher: evaluation.teacher ?? '',
    coefficient: evaluation.coefficient ?? 1,
    description: evaluation.description ?? '',
    evaluatedAt: isoDate(evaluation.date),
    levels: evaluation.levels ?? [],
    skills: (evaluation.skills ?? []).map((skill) => ({
      name: [skill.domainName, skill.itemName].filter(Boolean).join(' — '),
      level: skill.level,
    })),
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapAssignment(accountId: string, assignment: Assignment, at = new Date().toISOString()): Homework {
  return {
    id: makeId('hw', accountId, assignment.id),
    accountId,
    nativeId: assignment.id,
    subjectId: assignment.subject ? makeId('sub', accountId, assignment.subject.id) : null,
    subjectName: assignment.subject?.name ?? 'Matière inconnue',
    description: htmlToText(assignment.description),
    deadline: iso(assignment.deadline),
    done: assignment.done,
    difficulty: assignment.difficulty ?? null,
    estimatedMinutes: assignment.length ?? null,
    themes: (assignment.themes ?? []).map((theme) => theme.name),
    returnKind: assignment.return?.kind ?? null,
    resourceId: assignment.resourceID ?? null,
    attachments: (assignment.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      kind: attachment.kind,
    })),
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapDiscussion(accountId: string, discussion: Discussion, participants: string[], at = new Date().toISOString()): DomainDiscussion {
  return {
    id: makeId('dis', accountId, discussion.participantsMessageID || discussion.subject),
    accountId,
    nativeId: discussion.participantsMessageID,
    subject: discussion.subject ?? '',
    creator: discussion.creator ?? null,
    lastMessageAt: discussion.date ? iso(discussion.date) : null,
    messageCount: discussion.numberOfMessages ?? 0,
    unreadCount: discussion.numberOfMessagesUnread ?? 0,
    closed: discussion.closed ?? false,
    participants,
    updatedAt: at,
    syncedAt: at,
  };
}

export function mapMessages(accountId: string, discussionId: string, messages: DiscussionMessages, at = new Date().toISOString()): Message[] {
  return messages.sents.map((sent) => ({
    id: makeId('msg', accountId, sent.id),
    accountId,
    discussionId,
    nativeId: sent.id,
    authorName: sent.author?.name ?? null,
    authorKind: sent.author ? String(sent.author.kind) : null,
    contentText: htmlToText(sent.content),
    sentAt: iso(sent.creationDate),
    unread: false,
    attachments: (sent.files ?? []).map((file) => ({
      id: file.id,
      name: file.name,
      url: file.url,
      kind: file.kind,
    })),
    updatedAt: at,
    syncedAt: at,
  }));
}

export function mapTimetableClass(accountId: string, entry: AnyTimetableClass, at = new Date().toISOString()): DomainTimetableClass {
  const base = {
    id: makeId('tt', accountId, entry.id),
    accountId,
    nativeId: entry.id,
    startsAt: iso(entry.startDate),
    endsAt: iso(entry.endDate),
    updatedAt: at,
    syncedAt: at,
  };

  if (entry.is === 'lesson') {
    return {
      ...base,
      kind: 'lesson',
      subjectId: entry.subject ? makeId('sub', accountId, entry.subject.id) : null,
      subjectName: entry.subject?.name ?? null,
      title: entry.subject?.name ?? 'Cours',
      canceled: entry.canceled,
      exempted: entry.exempted,
      isTest: entry.test,
      status: entry.status ?? null,
      teachers: entry.teacherNames ?? [],
      rooms: entry.classrooms ?? [],
      groups: entry.groupNames ?? [],
      virtualClassrooms: entry.virtualClassrooms ?? [],
      resourceId: entry.lessonResourceID ?? null,
    };
  }

  if (entry.is === 'activity') {
    return {
      ...base,
      kind: 'activity',
      subjectId: null,
      subjectName: null,
      title: entry.title,
      canceled: false,
      exempted: false,
      isTest: false,
      status: entry.resourceTypeName ?? null,
      teachers: [],
      rooms: [],
      groups: entry.attendants ?? [],
      virtualClassrooms: [],
      resourceId: null,
    };
  }

  return {
    ...base,
    kind: 'detention',
    subjectId: null,
    subjectName: null,
    title: entry.title ?? 'Retenue',
    canceled: false,
    exempted: false,
    isTest: false,
    status: null,
    teachers: entry.teacherNames ?? [],
    rooms: entry.classrooms ?? [],
    groups: entry.personalNames ?? [],
    virtualClassrooms: [],
    resourceId: null,
  };
}

export function mapTimetable(accountId: string, timetable: Timetable, at = new Date().toISOString()): DomainTimetableClass[] {
  return (timetable.classes as AnyTimetableClass[]).map((entry) => mapTimetableClass(accountId, entry, at));
}

export function mapNotebook(accountId: string, notebook: Notebook, at = new Date().toISOString()): Absence[] {
  const absences: Absence[] = notebook.absences.map((absence) => ({
    id: makeId('abs', accountId, absence.id),
    accountId,
    nativeId: absence.id,
    kind: 'absence',
    startsAt: iso(absence.startDate),
    endsAt: iso(absence.endDate),
    minutes: Math.round((absence.hoursMissed ?? 0) * 60 + (absence.minutesMissed ?? 0)),
    daysMissed: absence.daysMissed ?? null,
    justified: absence.justified,
    reason: absence.reason ?? null,
    shouldParentsJustify: absence.shouldParentsJustify,
    administrativelyFixed: absence.administrativelyFixed,
    opened: absence.opened,
    updatedAt: at,
    syncedAt: at,
  }));

  for (const delay of notebook.delays) {
    absences.push({
      id: makeId('dly', accountId, delay.id),
      accountId,
      nativeId: delay.id,
      kind: 'delay',
      startsAt: iso(delay.date),
      endsAt: null,
      minutes: delay.minutes,
      daysMissed: null,
      justified: delay.justified,
      reason: delay.reason ?? delay.justification ?? null,
      shouldParentsJustify: delay.shouldParentsJustify,
      administrativelyFixed: delay.administrativelyFixed,
      opened: false,
      updatedAt: at,
      syncedAt: at,
    });
  }

  return absences;
}

export function mapNews(accountId: string, news: News, at = new Date().toISOString()): SchoolNewsItem[] {
  return news.items.map((item) => {
    const isSurvey = item.is === 'survey';
    const body = isSurvey ? '' : htmlToText((item as { content?: string }).content);
    return {
      id: makeId('nws', accountId, item.id),
      accountId,
      nativeId: item.id,
      title: item.title ?? '(sans titre)',
      category: item.category?.name ?? '',
      author: item.author ?? '',
      publishedAt: iso(item.creationDate),
      startsAt: item.startDate ? iso(item.startDate) : null,
      endsAt: item.endDate ? iso(item.endDate) : null,
      isRead: Boolean(item.read),
      isSurvey,
      bodyText: body,
      updatedAt: at,
      syncedAt: at,
    };
  });
}

function foodToCourses(section: string, foods: readonly { name: string; allergens: readonly { name: string }[] }[]): { section: string; items: CanteenCourse[] } {
  return {
    section,
    items: foods.map((food) => ({ name: food.name, allergens: food.allergens.map((allergen) => allergen.name) })),
  };
}

export function mapWeekMenu(accountId: string, menu: WeekMenu, at = new Date().toISOString()): CanteenMenu[] {
  const result: CanteenMenu[] = [];
  for (const day of menu.days) {
    const meals: [CanteenMenu['meal'], typeof day.lunch][] = [
      ['lunch', day.lunch],
      ['dinner', day.dinner],
    ];
    for (const [mealName, meal] of meals) {
      if (!meal) continue;
      const courses = [
        meal.entry ? foodToCourses('entrée', meal.entry) : null,
        meal.main ? foodToCourses('plat', meal.main) : null,
        meal.side ? foodToCourses('accompagnement', meal.side) : null,
        meal.fromage ? foodToCourses('fromage', meal.fromage) : null,
        meal.dessert ? foodToCourses('dessert', meal.dessert) : null,
        meal.drink ? foodToCourses('boisson', meal.drink) : null,
      ].filter((entry): entry is { section: string; items: CanteenCourse[] } => entry !== null);

      const allergens = new Set<string>();
      for (const course of courses) {
        for (const item of course.items) {
          for (const allergen of item.allergens) allergens.add(allergen);
        }
      }

      result.push({
        id: makeId('menu', accountId, isoDate(day.date), mealName),
        accountId,
        menuDate: isoDate(day.date),
        meal: mealName,
        courses,
        allergens: [...allergens],
        updatedAt: at,
        syncedAt: at,
      });
    }
  }
  return result;
}

export function mapResource(accountId: string, resource: Resource, at = new Date().toISOString()): SchoolDocument[] {
  const subjectId = makeId('sub', accountId, resource.subject.id);
  return resource.contents.map((content) => ({
    id: makeId('doc', accountId, resource.id, content.id),
    accountId,
    nativeId: `${resource.id}:${content.id}`,
    source: 'resource',
    title: content.title ?? content.categoryText ?? 'Cahier de textes',
    subjectId,
    subjectName: resource.subject.name,
    category: content.categoryText ?? String(content.category),
    descriptionText: htmlToText(content.description),
    startsAt: iso(resource.startDate),
    endsAt: iso(resource.endDate),
    updatedAt: at,
    syncedAt: at,
  }));
}

export function mapHolidays(accountId: string, instance: InstanceParameters, at = new Date().toISOString()): SchoolEvent[] {
  return instance.holidays.map((holiday: Holiday) => ({
    id: makeId('evt', accountId, holiday.id),
    accountId,
    nativeId: holiday.id,
    kind: 'holiday',
    title: holiday.name,
    startsAt: iso(holiday.startDate),
    endsAt: iso(holiday.endDate),
    description: null,
    source: 'pronote:instance.holidays',
    updatedAt: at,
    syncedAt: at,
  }));
}

export function mapTestsAsEvents(accountId: string, classes: DomainTimetableClass[], at = new Date().toISOString()): SchoolEvent[] {
  return classes
    .filter((entry) => entry.kind === 'lesson' && entry.isTest && !entry.canceled)
    .map((entry) => ({
      id: makeId('evt', accountId, `test:${entry.nativeId}`),
      accountId,
      nativeId: `test:${entry.nativeId}`,
      kind: 'test',
      title: `Contrôle — ${entry.subjectName ?? entry.title}`,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      description: entry.teachers.length > 0 ? `Professeur : ${entry.teachers.join(', ')}` : null,
      source: 'pronote:timetable.test',
      updatedAt: at,
      syncedAt: at,
    }));
}
