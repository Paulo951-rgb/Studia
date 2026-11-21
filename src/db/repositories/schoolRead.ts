import type { SqlDatabase } from '@/db/driver';
import { parseJsonArray, parseJsonObject, toBoolean } from '@/db/driver';
import type {
  Absence,
  Average,
  CanteenMenu,
  Discussion,
  Evaluation,
  Grade,
  Homework,
  Message,
  ReportCard,
  ReportCardSubject,
  SchoolDocument,
  SchoolEvent,
  SchoolNewsItem,
  SchoolPeriod,
  StudentProfile,
  Subject,
  TimetableClass,
} from '@/core/domain/types';

const now = () => new Date().toISOString();

type Range = { from?: string; to?: string; limit?: number };

function rangeClause(column: string, range: Range, params: (string | number)[]): string {
  let clause = '';
  if (range.from) {
    clause += ` AND ${column} >= ?`;
    params.push(range.from);
  }
  if (range.to) {
    clause += ` AND ${column} <= ?`;
    params.push(range.to);
  }
  return clause;
}

function limitClause(range: Range, params: (string | number)[], fallback = 100): string {
  params.push(Math.min(Math.max(range.limit ?? fallback, 1), 500));
  return ' LIMIT ?';
}

export function createSchoolReader(db: SqlDatabase) {
  return {
    async getProfile(accountId: string): Promise<StudentProfile | undefined> {
      const row = await db.get<{
        account_id: string;
        native_id: string;
        name: string;
        kind: string;
        class_name: string | null;
        establishment_name: string;
        profile_picture_url: string | null;
        is_delegate: number;
        is_director: number;
        is_member_ca: number;
        updated_at: string;
        synced_at: string;
      }>('SELECT * FROM student_profile WHERE account_id = ?', [accountId]);
      if (!row) return undefined;
      return {
        accountId: row.account_id,
        nativeId: row.native_id,
        name: row.name,
        kind: row.kind as StudentProfile['kind'],
        className: row.class_name,
        establishmentName: row.establishment_name,
        profilePictureUrl: row.profile_picture_url,
        isDelegate: toBoolean(row.is_delegate),
        isDirector: toBoolean(row.is_director),
        isMemberCa: toBoolean(row.is_member_ca),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      };
    },

    async listPeriods(accountId: string): Promise<SchoolPeriod[]> {
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        name: string;
        kind: number;
        start_date: string;
        end_date: string;
        is_default: number;
        updated_at: string;
        synced_at: string;
      }>('SELECT * FROM school_periods WHERE account_id = ? ORDER BY start_date', [accountId]);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        name: row.name,
        kind: row.kind,
        startDate: row.start_date,
        endDate: row.end_date,
        isDefault: toBoolean(row.is_default),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listSubjects(accountId: string): Promise<Subject[]> {
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        name: string;
        in_groups: number;
        updated_at: string;
        synced_at: string;
      }>('SELECT * FROM subjects WHERE account_id = ? ORDER BY name', [accountId]);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        name: row.name,
        inGroups: toBoolean(row.in_groups),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listGrades(options: { accountId: string; periodId?: string; subjectId?: string } & Range): Promise<Grade[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM grades WHERE account_id = ?';
      if (options.periodId) {
        sql += ' AND period_id = ?';
        params.push(options.periodId);
      }
      if (options.subjectId) {
        sql += ' AND subject_id = ?';
        params.push(options.subjectId);
      }
      sql += rangeClause('graded_at', options, params);
      sql += ' ORDER BY graded_at DESC';
      sql += limitClause(options, params, 200);

      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        period_id: string | null;
        subject_id: string | null;
        subject_name: string;
        value_points: number | null;
        value_kind: number;
        out_of_points: number | null;
        coefficient: number;
        graded_at: string;
        class_average: number | null;
        class_min: number | null;
        class_max: number | null;
        comment: string;
        comment_on_grade: string | null;
        is_bonus: number;
        is_optional: number;
        is_out_of_20: number;
        updated_at: string;
        synced_at: string;
      }>(sql, params);

      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        periodId: row.period_id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        valuePoints: row.value_points,
        valueKind: row.value_kind,
        outOfPoints: row.out_of_points,
        coefficient: row.coefficient,
        gradedAt: row.graded_at,
        classAverage: row.class_average,
        classMin: row.class_min,
        classMax: row.class_max,
        comment: row.comment,
        commentOnGrade: row.comment_on_grade,
        isBonus: toBoolean(row.is_bonus),
        isOptional: toBoolean(row.is_optional),
        isOutOf20: toBoolean(row.is_out_of_20),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listAverages(options: { accountId: string; periodId?: string }): Promise<Average[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM averages WHERE account_id = ?';
      if (options.periodId) {
        sql += ' AND period_id = ?';
        params.push(options.periodId);
      }
      const rows = await db.all<{
        id: string;
        account_id: string;
        period_id: string;
        subject_id: string | null;
        student_value: number | null;
        class_value: number | null;
        min_value: number | null;
        max_value: number | null;
        out_of: number | null;
        source: string;
        computed_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        periodId: row.period_id,
        subjectId: row.subject_id,
        studentValue: row.student_value,
        classValue: row.class_value,
        minValue: row.min_value,
        maxValue: row.max_value,
        outOf: row.out_of,
        source: row.source as Average['source'],
        computedAt: row.computed_at,
        syncedAt: row.synced_at,
      }));
    },

    async listReportCards(accountId: string, periodId?: string): Promise<(ReportCard & { subjects: ReportCardSubject[] })[]> {
      const params: (string | number)[] = [accountId];
      let sql = 'SELECT * FROM report_cards WHERE account_id = ?';
      if (periodId) {
        sql += ' AND period_id = ?';
        params.push(periodId);
      }
      const cards = await db.all<{
        id: string;
        account_id: string;
        period_id: string;
        general_comment: string | null;
        overall_assessments_json: string;
        source_url: string | null;
        updated_at: string;
        synced_at: string;
      }>(sql, params);

      const result: (ReportCard & { subjects: ReportCardSubject[] })[] = [];
      for (const card of cards) {
        const subjectRows = await db.all<{
          id: string;
          report_card_id: string;
          account_id: string;
          subject_id: string | null;
          subject_name: string;
          subject_group: string;
          coefficient: number;
          student_average: number | null;
          class_average: number | null;
          min_value: number | null;
          max_value: number | null;
          teachers_json: string;
          assessments_json: string;
          updated_at: string;
        }>('SELECT * FROM report_card_subjects WHERE report_card_id = ? ORDER BY subject_name', [card.id]);

        result.push({
          id: card.id,
          accountId: card.account_id,
          periodId: card.period_id,
          generalComment: card.general_comment,
          overallAssessments: parseJsonArray<{ name: string; value: string }>(card.overall_assessments_json),
          sourceUrl: card.source_url,
          updatedAt: card.updated_at,
          syncedAt: card.synced_at,
          subjects: subjectRows.map((row) => ({
            id: row.id,
            reportCardId: row.report_card_id,
            accountId: row.account_id,
            subjectId: row.subject_id,
            subjectName: row.subject_name,
            subjectGroup: row.subject_group,
            coefficient: row.coefficient,
            studentAverage: row.student_average,
            classAverage: row.class_average,
            minValue: row.min_value,
            maxValue: row.max_value,
            teachers: parseJsonArray<string>(row.teachers_json),
            assessments: parseJsonArray<string>(row.assessments_json),
            updatedAt: row.updated_at,
          })),
        });
      }
      return result;
    },

    async listEvaluations(options: { accountId: string; periodId?: string } & Range): Promise<Evaluation[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM evaluations WHERE account_id = ?';
      if (options.periodId) {
        sql += ' AND period_id = ?';
        params.push(options.periodId);
      }
      sql += rangeClause('evaluated_at', options, params);
      sql += ' ORDER BY evaluated_at DESC';
      sql += limitClause(options, params, 100);
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        period_id: string | null;
        subject_id: string | null;
        subject_name: string;
        name: string;
        teacher: string;
        coefficient: number;
        description: string;
        evaluated_at: string;
        levels_json: string;
        skills_json: string;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        periodId: row.period_id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        name: row.name,
        teacher: row.teacher,
        coefficient: row.coefficient,
        description: row.description,
        evaluatedAt: row.evaluated_at,
        levels: parseJsonArray<string>(row.levels_json),
        skills: parseJsonArray<{ name: string; level: string }>(row.skills_json),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listHomework(
      options: { accountId: string; subjectId?: string; includeDone?: boolean } & Range,
    ): Promise<Homework[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM homework WHERE account_id = ?';
      if (options.subjectId) {
        sql += ' AND subject_id = ?';
        params.push(options.subjectId);
      }
      if (!options.includeDone) sql += ' AND done = 0';
      sql += rangeClause('deadline', options, params);
      sql += ' ORDER BY deadline ASC';
      sql += limitClause(options, params, 100);
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        subject_id: string | null;
        subject_name: string;
        description: string;
        deadline: string;
        done: number;
        difficulty: number | null;
        estimated_minutes: number | null;
        themes_json: string;
        return_kind: number | null;
        resource_id: string | null;
        attachments_json: string;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        description: row.description,
        deadline: row.deadline,
        done: toBoolean(row.done),
        difficulty: row.difficulty,
        estimatedMinutes: row.estimated_minutes,
        themes: parseJsonArray<string>(row.themes_json),
        returnKind: row.return_kind,
        resourceId: row.resource_id,
        attachments: parseJsonArray(row.attachments_json),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listDiscussions(accountId: string, limit = 50): Promise<Discussion[]> {
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        subject: string;
        creator: string | null;
        last_message_at: string | null;
        message_count: number;
        unread_count: number;
        closed: number;
        participants_json: string;
        updated_at: string;
        synced_at: string;
      }>(
        'SELECT * FROM discussions WHERE account_id = ? ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT ?',
        [accountId, Math.min(Math.max(limit, 1), 200)],
      );
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        subject: row.subject,
        creator: row.creator,
        lastMessageAt: row.last_message_at,
        messageCount: row.message_count,
        unreadCount: row.unread_count,
        closed: toBoolean(row.closed),
        participants: parseJsonArray<string>(row.participants_json),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listMessages(options: { accountId: string; discussionId?: string } & Range): Promise<Message[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM messages WHERE account_id = ?';
      if (options.discussionId) {
        sql += ' AND discussion_id = ?';
        params.push(options.discussionId);
      }
      sql += rangeClause('sent_at', options, params);
      sql += ' ORDER BY sent_at DESC';
      sql += limitClause(options, params, 50);
      const rows = await db.all<{
        id: string;
        account_id: string;
        discussion_id: string;
        native_id: string;
        author_name: string | null;
        author_kind: string | null;
        content_text: string;
        sent_at: string;
        unread: number;
        attachments_json: string;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        discussionId: row.discussion_id,
        nativeId: row.native_id,
        authorName: row.author_name,
        authorKind: row.author_kind,
        contentText: row.content_text,
        sentAt: row.sent_at,
        unread: toBoolean(row.unread),
        attachments: parseJsonArray(row.attachments_json),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async getMessage(id: string): Promise<Message | undefined> {
      const messages = await db.all<{ id: string }>('SELECT id FROM messages WHERE id = ?', [id]);
      if (messages.length === 0) return undefined;
      const rows = await this.listMessages({ accountId: (await db.get<{ account_id: string }>('SELECT account_id FROM messages WHERE id = ?', [id]))?.account_id ?? '', limit: 500 });
      return rows.find((message) => message.id === id);
    },

    async listTimetable(options: { accountId: string } & Range): Promise<TimetableClass[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM timetable WHERE account_id = ?';
      sql += rangeClause('starts_at', options, params);
      sql += ' ORDER BY starts_at ASC';
      sql += limitClause(options, params, 200);
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        kind: string;
        subject_id: string | null;
        subject_name: string | null;
        title: string;
        starts_at: string;
        ends_at: string;
        canceled: number;
        exempted: number;
        is_test: number;
        status: string | null;
        teachers_json: string;
        rooms_json: string;
        groups_json: string;
        virtual_classrooms_json: string;
        resource_id: string | null;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        kind: row.kind as TimetableClass['kind'],
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        canceled: toBoolean(row.canceled),
        exempted: toBoolean(row.exempted),
        isTest: toBoolean(row.is_test),
        status: row.status,
        teachers: parseJsonArray<string>(row.teachers_json),
        rooms: parseJsonArray<string>(row.rooms_json),
        groups: parseJsonArray<string>(row.groups_json),
        virtualClassrooms: parseJsonArray<string>(row.virtual_classrooms_json),
        resourceId: row.resource_id,
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listEvents(options: { accountId: string } & Range): Promise<SchoolEvent[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM events WHERE account_id = ?';
      sql += rangeClause('starts_at', options, params);
      sql += ' ORDER BY starts_at ASC';
      sql += limitClause(options, params, 100);
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        kind: string;
        title: string;
        starts_at: string;
        ends_at: string | null;
        description: string | null;
        source: string;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        kind: row.kind as SchoolEvent['kind'],
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        description: row.description,
        source: row.source,
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listAbsences(options: { accountId: string; kind?: Absence['kind'] } & Range): Promise<Absence[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM absences WHERE account_id = ?';
      if (options.kind) {
        sql += ' AND kind = ?';
        params.push(options.kind);
      }
      sql += rangeClause('starts_at', options, params);
      sql += ' ORDER BY starts_at DESC';
      sql += limitClause(options, params, 100);
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        kind: string;
        starts_at: string;
        ends_at: string | null;
        minutes: number | null;
        days_missed: number | null;
        justified: number;
        reason: string | null;
        should_parents_justify: number;
        administratively_fixed: number;
        opened: number;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        kind: row.kind as Absence['kind'],
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        minutes: row.minutes,
        daysMissed: row.days_missed,
        justified: toBoolean(row.justified),
        reason: row.reason,
        shouldParentsJustify: toBoolean(row.should_parents_justify),
        administrativelyFixed: toBoolean(row.administratively_fixed),
        opened: toBoolean(row.opened),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listNews(options: { accountId: string; limit?: number; unreadOnly?: boolean }): Promise<SchoolNewsItem[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM school_news WHERE account_id = ?';
      if (options.unreadOnly) sql += ' AND is_read = 0';
      sql += ' ORDER BY published_at DESC LIMIT ?';
      params.push(Math.min(Math.max(options.limit ?? 20, 1), 100));
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        title: string;
        category: string;
        author: string;
        published_at: string;
        starts_at: string | null;
        ends_at: string | null;
        is_read: number;
        is_survey: number;
        body_text: string | null;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        title: row.title,
        category: row.category,
        author: row.author,
        publishedAt: row.published_at,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isRead: toBoolean(row.is_read),
        isSurvey: toBoolean(row.is_survey),
        bodyText: row.body_text,
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listCanteenMenus(options: { accountId: string; from?: string; to?: string; limit?: number }): Promise<CanteenMenu[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM canteen_menus WHERE account_id = ?';
      if (options.from) {
        sql += ' AND menu_date >= ?';
        params.push(options.from);
      }
      if (options.to) {
        sql += ' AND menu_date <= ?';
        params.push(options.to);
      }
      sql += ' ORDER BY menu_date ASC, meal ASC LIMIT ?';
      params.push(Math.min(Math.max(options.limit ?? 10, 1), 60));
      const rows = await db.all<{
        id: string;
        account_id: string;
        menu_date: string;
        meal: string;
        courses_json: string;
        allergens_json: string;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        menuDate: row.menu_date,
        meal: row.meal as CanteenMenu['meal'],
        courses: parseJsonArray<{ section: string; items: { name: string; allergens: string[] }[] }>(row.courses_json),
        allergens: parseJsonArray<string>(row.allergens_json),
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async listDocuments(options: { accountId: string; subjectId?: string; limit?: number }): Promise<SchoolDocument[]> {
      const params: (string | number)[] = [options.accountId];
      let sql = 'SELECT * FROM documents WHERE account_id = ?';
      if (options.subjectId) {
        sql += ' AND subject_id = ?';
        params.push(options.subjectId);
      }
      sql += ' ORDER BY COALESCE(starts_at, updated_at) DESC LIMIT ?';
      params.push(Math.min(Math.max(options.limit ?? 30, 1), 100));
      const rows = await db.all<{
        id: string;
        account_id: string;
        native_id: string;
        source: string;
        title: string;
        subject_id: string | null;
        subject_name: string | null;
        category: string | null;
        description_text: string;
        starts_at: string | null;
        ends_at: string | null;
        updated_at: string;
        synced_at: string;
      }>(sql, params);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        nativeId: row.native_id,
        source: row.source as SchoolDocument['source'],
        title: row.title,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        category: row.category,
        descriptionText: row.description_text,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        updatedAt: row.updated_at,
        syncedAt: row.synced_at,
      }));
    },

    async getDocument(id: string): Promise<SchoolDocument | undefined> {
      const row = await db.get<{ account_id: string }>('SELECT account_id FROM documents WHERE id = ?', [id]);
      if (!row) return undefined;
      const documents = await this.listDocuments({ accountId: row.account_id, limit: 100 });
      return documents.find((document) => document.id === id);
    },

    async listAttachments(ownerType: string, ownerId: string) {
      const rows = await db.all<{
        id: string;
        name: string;
        url: string;
        kind: number | null;
        local_path: string | null;
        mime: string | null;
      }>('SELECT * FROM attachments WHERE owner_type = ? AND owner_id = ?', [ownerType, ownerId]);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        kind: row.kind,
        localPath: row.local_path,
        mime: row.mime,
      }));
    },

    async counts(accountId: string): Promise<Record<string, number>> {
      const tables = [
        'grades',
        'homework',
        'messages',
        'documents',
        'timetable',
        'absences',
        'school_news',
        'canteen_menus',
        'report_cards',
        'evaluations',
      ];
      const result: Record<string, number> = {};
      for (const table of tables) {
        const row = await db.get<{ c: number }>(`SELECT count(*) AS c FROM ${table} WHERE account_id = ?`, [accountId]);
        result[table] = row?.c ?? 0;
      }
      return result;
    },

    async latestSync(accountId: string) {
      const row = await db.get<{
        kind: string;
        status: string;
        started_at: string;
        finished_at: string | null;
        resources_json: string;
        error_code: string | null;
      }>('SELECT * FROM sync_history WHERE account_id = ? ORDER BY started_at DESC LIMIT 1', [accountId]);
      if (!row) return undefined;
      return {
        kind: row.kind,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        resources: parseJsonObject<Record<string, unknown>>(row.resources_json, {}),
        errorCode: row.error_code,
      };
    },

    async setNewsRead(accountId: string, newsId: string, read: boolean): Promise<void> {
      await db.run('UPDATE school_news SET is_read = ?, updated_at = ? WHERE account_id = ? AND id = ?', [
        read ? 1 : 0,
        now(),
        accountId,
        newsId,
      ]);
    },
  };
}

export type SchoolReader = ReturnType<typeof createSchoolReader>;
