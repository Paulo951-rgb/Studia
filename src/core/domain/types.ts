/**
 * Domain types shared by the database layer, the connectors and the UI.
 * All timestamps are ISO 8601 strings in UTC; all calendar dates are `YYYY-MM-DD`.
 */

export type IsoDateTime = string;
export type IsoDate = string;

export type AccountKind = 'student' | 'parent' | 'teacher' | 'staff';

export type Account = {
  id: string;
  provider: 'pronote';
  displayName: string;
  schoolUrl: string;
  accountKind: AccountKind;
  resourceId: string | null;
  studentName: string | null;
  className: string | null;
  establishmentName: string | null;
  status: 'active' | 'expired' | 'disabled';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastSyncAt: IsoDateTime | null;
};

export type SessionRecord = {
  id: string;
  accountId: string;
  deviceUuid: string;
  /** Name of the SecureStore entry holding the PRONOTE token. Never the token itself. */
  secretRef: string;
  navigatorIdentifier: string | null;
  createdAt: IsoDateTime;
  lastUsedAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
  invalidatedAt: IsoDateTime | null;
  invalidReason: string | null;
};

export type StudentProfile = {
  accountId: string;
  nativeId: string;
  name: string;
  kind: AccountKind;
  className: string | null;
  establishmentName: string;
  profilePictureUrl: string | null;
  isDelegate: boolean;
  isDirector: boolean;
  isMemberCa: boolean;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type SchoolPeriod = {
  id: string;
  accountId: string;
  nativeId: string;
  name: string;
  kind: number;
  startDate: IsoDate;
  endDate: IsoDate;
  isDefault: boolean;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Subject = {
  id: string;
  accountId: string;
  nativeId: string;
  name: string;
  inGroups: boolean;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Grade = {
  id: string;
  accountId: string;
  nativeId: string;
  periodId: string | null;
  subjectId: string | null;
  subjectName: string;
  valuePoints: number | null;
  valueKind: number;
  outOfPoints: number | null;
  coefficient: number;
  gradedAt: IsoDate;
  classAverage: number | null;
  classMin: number | null;
  classMax: number | null;
  comment: string;
  commentOnGrade: string | null;
  isBonus: boolean;
  isOptional: boolean;
  isOutOf20: boolean;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type AverageSource = 'pronote' | 'computed';

export type Average = {
  id: string;
  accountId: string;
  periodId: string;
  subjectId: string | null;
  studentValue: number | null;
  classValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  outOf: number | null;
  source: AverageSource;
  computedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type ReportCard = {
  id: string;
  accountId: string;
  periodId: string;
  generalComment: string | null;
  overallAssessments: { name: string; value: string }[];
  sourceUrl: string | null;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type ReportCardSubject = {
  id: string;
  reportCardId: string;
  accountId: string;
  subjectId: string | null;
  subjectName: string;
  subjectGroup: string;
  coefficient: number;
  studentAverage: number | null;
  classAverage: number | null;
  minValue: number | null;
  maxValue: number | null;
  teachers: string[];
  assessments: string[];
  updatedAt: IsoDateTime;
};

export type Evaluation = {
  id: string;
  accountId: string;
  nativeId: string;
  periodId: string | null;
  subjectId: string | null;
  subjectName: string;
  name: string;
  teacher: string;
  coefficient: number;
  description: string;
  evaluatedAt: IsoDate;
  levels: string[];
  skills: { name: string; level: string }[];
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Homework = {
  id: string;
  accountId: string;
  nativeId: string;
  subjectId: string | null;
  subjectName: string;
  description: string;
  deadline: IsoDateTime;
  done: boolean;
  difficulty: number | null;
  estimatedMinutes: number | null;
  themes: string[];
  returnKind: number | null;
  resourceId: string | null;
  attachments: { id: string; name: string; url: string; kind: number }[];
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Discussion = {
  id: string;
  accountId: string;
  nativeId: string;
  subject: string;
  creator: string | null;
  lastMessageAt: IsoDateTime | null;
  messageCount: number;
  unreadCount: number;
  closed: boolean;
  participants: string[];
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Message = {
  id: string;
  accountId: string;
  discussionId: string;
  nativeId: string;
  authorName: string | null;
  authorKind: string | null;
  contentText: string;
  sentAt: IsoDateTime;
  unread: boolean;
  attachments: { id: string; name: string; url: string; kind: number }[];
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Attachment = {
  id: string;
  accountId: string;
  ownerType: 'homework' | 'message' | 'document' | 'news' | 'timetable' | 'report_card';
  ownerId: string;
  name: string;
  url: string;
  kind: number | null;
  mime: string | null;
  sizeBytes: number | null;
  localPath: string | null;
  sha256: string | null;
  fetchedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
};

export type TimetableClass = {
  id: string;
  accountId: string;
  nativeId: string;
  kind: 'lesson' | 'activity' | 'detention';
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  canceled: boolean;
  exempted: boolean;
  isTest: boolean;
  status: string | null;
  teachers: string[];
  rooms: string[];
  groups: string[];
  virtualClassrooms: string[];
  resourceId: string | null;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type SchoolEvent = {
  id: string;
  accountId: string;
  nativeId: string;
  kind: 'holiday' | 'school_event' | 'test' | 'other';
  title: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  description: string | null;
  source: string;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type Absence = {
  id: string;
  accountId: string;
  nativeId: string;
  kind: 'absence' | 'delay';
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  minutes: number | null;
  daysMissed: number | null;
  justified: boolean;
  reason: string | null;
  shouldParentsJustify: boolean;
  administrativelyFixed: boolean;
  opened: boolean;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type SchoolNewsItem = {
  id: string;
  accountId: string;
  nativeId: string;
  title: string;
  category: string;
  author: string;
  publishedAt: IsoDateTime;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  isRead: boolean;
  isSurvey: boolean;
  bodyText: string | null;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type CanteenCourse = { name: string; allergens: string[] };

export type CanteenMenu = {
  id: string;
  accountId: string;
  menuDate: IsoDate;
  meal: 'lunch' | 'dinner';
  courses: { section: string; items: CanteenCourse[] }[];
  allergens: string[];
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type DocumentKind = 'resource' | 'attachment' | 'news' | 'message' | 'report_card';

export type SchoolDocument = {
  id: string;
  accountId: string;
  nativeId: string;
  source: DocumentKind;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  category: string | null;
  descriptionText: string;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  syncedAt: IsoDateTime;
};

export type SyncRunKind = 'initial' | 'incremental' | 'manual' | 'background';
export type SyncRunStatus = 'ok' | 'partial' | 'error' | 'aborted';

export type SyncHistoryEntry = {
  id: string;
  accountId: string;
  kind: SyncRunKind;
  startedAt: IsoDateTime;
  finishedAt: IsoDateTime | null;
  status: SyncRunStatus;
  resources: Record<string, { status: 'ok' | 'error' | 'skipped'; items: number; errorCode?: string }>;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
};

export type Conversation = {
  id: string;
  accountId: string | null;
  title: string;
  model: string;
  memoryEnabled: boolean;
  archived: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: ChatRole;
  contentText: string;
  toolCalls: { id: string; name: string; arguments: string }[] | null;
  toolCallId: string | null;
  toolName: string | null;
  status: 'complete' | 'streaming' | 'error' | 'cancelled';
  errorCode: string | null;
  createdAt: IsoDateTime;
};

export type MemoryScope = 'user' | 'school';

export type AiMemory = {
  id: string;
  accountId: string | null;
  scope: MemoryScope;
  key: string;
  value: string;
  source: 'user' | 'assistant' | 'manual';
  confidence: number | null;
  conversationId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
};

export type SearchHit = {
  kind: string;
  refId: string;
  title: string;
  snippet: string;
  score: number;
};
