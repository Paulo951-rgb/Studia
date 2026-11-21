import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Assignment,
  Discussion,
  DiscussionMessages,
  Grade as PronoteGrade,
  GradesOverview,
  News,
  Period as PronotePeriod,
  Timetable,
  WeekMenu,
} from '@blockshub/pawnote-lts';
import {
  mapAssignment,
  mapDiscussion,
  mapGrade,
  mapGradesOverview,
  mapMessages,
  mapNews,
  mapPeriod,
  mapTimetable,
  mapWeekMenu,
} from '@/core/pronote/mappers';
import { ACCOUNT_ID } from '../helpers/fixtures';
import { makeId } from '@/core/util/ids';

const at = '2026-03-01T00:00:00.000Z';

test('periods keep stable ids and calendar dates', () => {
  const period = { id: 'A001', name: 'Trimestre 1', kind: 1, startDate: new Date('2025-09-01T00:00:00Z'), endDate: new Date('2025-12-05T00:00:00Z') } as PronotePeriod;
  const mapped = mapPeriod(ACCOUNT_ID, period, true, at);
  assert.equal(mapped.id, makeId('per', ACCOUNT_ID, 'A001'));
  assert.equal(mapped.startDate, '2025-09-01');
  assert.equal(mapped.isDefault, true);
});

test('grades are mapped with scale, coefficient and class statistics', () => {
  const grade = {
    id: 'G1',
    subject: { id: 'M1', name: 'Mathématiques', inGroups: false },
    value: { points: 7, kind: 0 },
    outOf: { points: 10 },
    coefficient: 2,
    date: new Date('2025-10-01T00:00:00Z'),
    average: { points: 6.5 },
    min: { points: 2 },
    max: { points: 10 },
    comment: 'Bon travail',
    isBonus: false,
    isOptional: false,
    isOutOf20: false,
  } as unknown as PronoteGrade;

  const mapped = mapGrade(ACCOUNT_ID, 'per_t1', grade, at);
  assert.equal(mapped.valuePoints, 7);
  assert.equal(mapped.outOfPoints, 10);
  assert.equal(mapped.coefficient, 2);
  assert.equal(mapped.gradedAt, '2025-10-01');
  assert.equal(mapped.subjectId, makeId('sub', ACCOUNT_ID, 'M1'));
  assert.equal(mapped.comment, 'Bon travail');
});

test('grades overview exposes subject averages and the overall average', () => {
  const overview = {
    subjectsAverages: [
      {
        subject: { id: 'M1', name: 'Mathématiques', inGroups: false },
        student: { points: 13.5 },
        class_average: { points: 12.1 },
        min: { points: 5 },
        max: { points: 19 },
        outOf: { points: 20 },
      },
    ],
    overallAverage: { points: 13.2 },
    classAverage: { points: 11.9 },
    grades: [],
  } as unknown as GradesOverview;

  const mapped = mapGradesOverview(ACCOUNT_ID, 'per_t1', overview, at);
  assert.equal(mapped.averages.length, 2);
  assert.equal(mapped.averages[0]?.studentValue, 13.5);
  assert.equal(mapped.averages[0]?.source, 'pronote');
  const overall = mapped.averages.find((entry) => entry.subjectId === null);
  assert.equal(overall?.studentValue, 13.2);
  assert.equal(mapped.subjects.length, 1);
});

test('homework descriptions are converted to text and attachments preserved', () => {
  const assignment = {
    id: 'H1',
    subject: { id: 'M1', name: 'Mathématiques', inGroups: false },
    description: '<p>Exercices <b>12</b> à 18</p>',
    deadline: new Date('2026-03-05T17:00:00Z'),
    done: false,
    difficulty: 2,
    length: 30,
    themes: [{ name: 'Thalès' }],
    return: { kind: 0 },
    attachments: [{ id: 'att', name: 'fiche.pdf', url: 'https://exemple.net/fiche.pdf', kind: 1 }],
  } as unknown as Assignment;

  const mapped = mapAssignment(ACCOUNT_ID, assignment, at);
  assert.equal(mapped.description, 'Exercices 12 à 18');
  assert.equal(mapped.estimatedMinutes, 30);
  assert.deepEqual(mapped.themes, ['Thalès']);
  assert.equal(mapped.attachments[0]?.name, 'fiche.pdf');
});

test('discussion and message mapping keeps authorship and strips HTML', () => {
  const discussion = {
    subject: 'Sortie',
    creator: 'Mme Dupont',
    date: new Date('2026-03-02T09:00:00Z'),
    numberOfMessages: 2,
    numberOfMessagesUnread: 1,
    closed: false,
    participantsMessageID: 'D1',
  } as unknown as Discussion;

  const mapped = mapDiscussion(ACCOUNT_ID, discussion, ['Mme Dupont'], at);
  assert.equal(mapped.id, makeId('dis', ACCOUNT_ID, 'D1'));
  assert.equal(mapped.unreadCount, 1);

  const messages = {
    defaultReplyMessageID: '1',
    sents: [
      {
        id: 'MSG1',
        content: '<p>Bonjour</p>',
        creationDate: new Date('2026-03-02T09:00:00Z'),
        author: { name: 'Mme Dupont', kind: 3 },
        partialVisibility: false,
        amountOfRecipients: 1,
        files: [],
      },
    ],
    drafts: [],
    canIncludeStudentsAndParents: false,
  } as unknown as DiscussionMessages;

  const mappedMessages = mapMessages(ACCOUNT_ID, mapped.id, messages, at);
  assert.equal(mappedMessages.length, 1);
  assert.equal(mappedMessages[0]?.contentText, 'Bonjour');
  assert.equal(mappedMessages[0]?.authorName, 'Mme Dupont');
});

test('timetable maps lessons, activities and detentions without losing cancellation flags', () => {
  const timetable = {
    classes: [
      {
        is: 'lesson',
        id: 'T1',
        startDate: new Date('2026-03-03T08:00:00Z'),
        endDate: new Date('2026-03-03T09:00:00Z'),
        blockLength: 1,
        blockPosition: 1,
        weekNumber: 27,
        kind: 1,
        canceled: true,
        exempted: false,
        test: true,
        virtualClassrooms: [],
        personalNames: [],
        teacherNames: ['M. Bernard'],
        classrooms: ['204'],
        groupNames: [],
        subject: { id: 'M1', name: 'Mathématiques', inGroups: false },
      },
      {
        is: 'activity',
        id: 'T2',
        startDate: new Date('2026-03-04T08:00:00Z'),
        endDate: new Date('2026-03-04T18:00:00Z'),
        blockLength: 1,
        blockPosition: 1,
        weekNumber: 27,
        title: 'Sortie au musée',
        attendants: ['Mme Dupont'],
        resourceTypeName: 'Sortie',
        resourceValue: 'Musée',
      },
      {
        is: 'detention',
        id: 'T3',
        startDate: new Date('2026-03-05T16:00:00Z'),
        endDate: new Date('2026-03-05T17:00:00Z'),
        blockLength: 1,
        blockPosition: 1,
        weekNumber: 27,
        personalNames: [],
        teacherNames: [],
        classrooms: [],
      },
    ],
    absences: [],
    withCanceledClasses: true,
  } as unknown as Timetable;

  const mapped = mapTimetable(ACCOUNT_ID, timetable, at);
  assert.equal(mapped.length, 3);
  assert.equal(mapped[0]?.kind, 'lesson');
  assert.equal(mapped[0]?.canceled, true);
  assert.equal(mapped[0]?.isTest, true);
  assert.equal(mapped[1]?.title, 'Sortie au musée');
  assert.equal(mapped[2]?.kind, 'detention');
  assert.equal(mapped[2]?.title, 'Retenue');
});

test('news bodies are plain text and surveys keep their flag', () => {
  const news = {
    items: [
      {
        is: 'information',
        id: 'N1',
        title: 'Réunion',
        category: { id: 'c1', name: 'Vie scolaire' },
        creationDate: new Date('2026-03-01T10:00:00Z'),
        author: 'Direction',
        read: false,
        question: { content: '<p>Le 12 mars à 17h</p>' },
        get content() {
          return '<p>Le 12 mars à 17h</p>';
        },
      },
      {
        is: 'survey',
        id: 'N2',
        title: 'Sondage cantine',
        category: { id: 'c2', name: 'Sondages' },
        creationDate: new Date('2026-03-02T10:00:00Z'),
        author: 'Direction',
        read: true,
        questions: [],
      },
    ],
  } as unknown as News;

  const mapped = mapNews(ACCOUNT_ID, news, at);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0]?.bodyText, 'Le 12 mars à 17h');
  assert.equal(mapped[1]?.isSurvey, true);
});

test('canteen menus flatten meals and collect allergens', () => {
  const week = {
    containsLunch: true,
    containsDinner: false,
    days: [
      {
        date: new Date('2026-03-03T00:00:00Z'),
        lunch: {
          entry: [{ name: 'Salade', allergens: [], labels: [] }],
          main: [{ name: 'Poulet', allergens: [{ name: 'gluten', color: '#fff' }], labels: [] }],
        },
        dinner: null,
      },
    ],
    weeks: [27],
    allergens: [],
    labels: [],
  } as unknown as WeekMenu;

  const mapped = mapWeekMenu(ACCOUNT_ID, week, at);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]?.menuDate, '2026-03-03');
  assert.deepEqual(mapped[0]?.allergens, ['gluten']);
  assert.equal(mapped[0]?.courses.length, 2);
});
