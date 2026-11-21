import type { SqlDatabase } from '@/db/driver';
import { fromBoolean, parseJsonArray } from '@/db/driver';
import { deleteByIds, reconcile, upsert, type UpsertOutcome } from '@/db/upsert';
import { contentHash } from '@/core/util/hash';
import { makeId } from '@/core/util/ids';
import type {
  Absence,
  AiMemory,
  Attachment,
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
import type { createSearchRepo } from '@/db/repositories/search';

export type WriteStats = { inserted: number; updated: number; unchanged: number; removed: number };

const emptyStats = (): WriteStats => ({ inserted: 0, updated: 0, unchanged: 0, removed: 0 });

function tally(stats: WriteStats, outcome: UpsertOutcome): void {
  if (outcome === 'inserted') stats.inserted += 1;
  else if (outcome === 'updated') stats.updated += 1;
  else stats.unchanged += 1;
}

function attachmentsJson(attachments: Attachment[]): string {
  return JSON.stringify(
    attachments.map((attachment) => ({ id: attachment.id, name: attachment.name, url: attachment.url, kind: attachment.kind })),
  );
}

function attachmentId(accountId: string, ownerType: string, ownerId: string, name: string, url: string): string {
  return makeId('att', accountId, ownerType, ownerId, name, url);
}

export function createSchoolWriter(db: SqlDatabase, search: ReturnType<typeof createSearchRepo>) {
  async function saveAttachment(
    accountId: string,
    ownerType: Attachment['ownerType'],
    ownerId: string,
    attachment: { id: string; name: string; url: string; kind: number },
  ): Promise<void> {
    const id = attachmentId(accountId, ownerType, ownerId, attachment.name, attachment.url);
    await upsert(
      db,
      'attachments',
      {
        id,
        account_id: accountId,
        owner_type: ownerType,
        owner_id: ownerId,
        name: attachment.name,
        url: attachment.url,
        kind: attachment.kind,
        updated_at: new Date().toISOString(),
        content_hash: contentHash({ ownerType, ownerId, attachment }),
      },
      { contentHash: contentHash({ ownerType, ownerId, attachment }) },
    );
  }

  return {
    async saveProfile(profile: StudentProfile): Promise<void> {
      await upsert(
        db,
        'student_profile',
        {
          account_id: profile.accountId,
          native_id: profile.nativeId,
          name: profile.name,
          kind: profile.kind,
          class_name: profile.className,
          establishment_name: profile.establishmentName,
          profile_picture_url: profile.profilePictureUrl,
          is_delegate: fromBoolean(profile.isDelegate),
          is_director: fromBoolean(profile.isDirector),
          is_member_ca: fromBoolean(profile.isMemberCa),
          updated_at: profile.updatedAt,
          synced_at: profile.syncedAt,
        },
        { idColumn: 'account_id' },
      );
    },

    async savePeriods(accountId: string, periods: SchoolPeriod[], complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      for (const period of periods) {
        tally(
          stats,
          await upsert(
            db,
            'school_periods',
            {
              id: period.id,
              account_id: accountId,
              native_id: period.nativeId,
              name: period.name,
              kind: period.kind,
              start_date: period.startDate,
              end_date: period.endDate,
              is_default: fromBoolean(period.isDefault),
              updated_at: period.updatedAt,
              synced_at: period.syncedAt,
              content_hash: contentHash(period),
            },
            { contentHash: contentHash(period) },
          ),
        );
      }
      if (complete) {
        stats.removed = await reconcile(db, 'school_periods', { column: 'account_id', value: accountId }, periods.map((p) => p.id));
      }
      return stats;
    },

    async saveSubjects(accountId: string, subjects: Subject[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const subject of subjects) {
        tally(
          stats,
          await upsert(
            db,
            'subjects',
            {
              id: subject.id,
              account_id: accountId,
              native_id: subject.nativeId,
              name: subject.name,
              in_groups: fromBoolean(subject.inGroups),
              updated_at: subject.updatedAt,
              synced_at: subject.syncedAt,
              content_hash: contentHash(subject),
            },
            { contentHash: contentHash(subject) },
          ),
        );
      }
      return stats;
    },

    async saveGrades(accountId: string, periodId: string, grades: Grade[], complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      for (const grade of grades) {
        const hash = contentHash(grade);
        const outcome = await upsert(
          db,
          'grades',
          {
            id: grade.id,
            account_id: accountId,
            native_id: grade.nativeId,
            period_id: periodId,
            subject_id: grade.subjectId,
            subject_name: grade.subjectName,
            value_points: grade.valuePoints,
            value_kind: grade.valueKind,
            out_of_points: grade.outOfPoints,
            coefficient: grade.coefficient,
            graded_at: grade.gradedAt,
            class_average: grade.classAverage,
            class_min: grade.classMin,
            class_max: grade.classMax,
            comment: grade.comment,
            comment_on_grade: grade.commentOnGrade,
            is_bonus: fromBoolean(grade.isBonus),
            is_optional: fromBoolean(grade.isOptional),
            is_out_of_20: fromBoolean(grade.isOutOf20),
            updated_at: grade.updatedAt,
            synced_at: grade.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'grade_comment',
            refId: grade.id,
            accountId,
            title: `${grade.subjectName} — ${grade.gradedAt}`,
            body: [grade.comment, grade.commentOnGrade].filter(Boolean).join('\n'),
          });
        }
      }
      if (complete) {
        const rows = await db.all<{ id: string }>('SELECT id FROM grades WHERE account_id = ? AND period_id = ?', [
          accountId,
          periodId,
        ]);
        const keep = new Set(grades.map((grade) => grade.id));
        stats.removed = await deleteByIds(
          db,
          'grades',
          rows.map((row) => row.id).filter((id) => !keep.has(id)),
        );
      }
      return stats;
    },

    async saveAverages(accountId: string, averages: Average[]): Promise<void> {
      for (const average of averages) {
        await upsert(db, 'averages', {
          id: average.id,
          account_id: accountId,
          period_id: average.periodId,
          subject_id: average.subjectId,
          student_value: average.studentValue,
          class_value: average.classValue,
          min_value: average.minValue,
          max_value: average.maxValue,
          out_of: average.outOf,
          source: average.source,
          computed_at: average.computedAt,
          synced_at: average.syncedAt,
        });
      }
    },

    async saveReportCard(
      accountId: string,
      reportCard: ReportCard,
      subjects: ReportCardSubject[],
    ): Promise<WriteStats> {
      const stats = emptyStats();
      const hash = contentHash({ reportCard, subjects });
      tally(
        stats,
        await upsert(
          db,
          'report_cards',
          {
            id: reportCard.id,
            account_id: accountId,
            period_id: reportCard.periodId,
            general_comment: reportCard.generalComment,
            overall_assessments_json: JSON.stringify(reportCard.overallAssessments),
            source_url: reportCard.sourceUrl,
            updated_at: reportCard.updatedAt,
            synced_at: reportCard.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        ),
      );

      for (const subject of subjects) {
        await upsert(
          db,
          'report_card_subjects',
          {
            id: subject.id,
            report_card_id: reportCard.id,
            account_id: accountId,
            subject_id: subject.subjectId,
            subject_name: subject.subjectName,
            subject_group: subject.subjectGroup,
            coefficient: subject.coefficient,
            student_average: subject.studentAverage,
            class_average: subject.classAverage,
            min_value: subject.minValue,
            max_value: subject.maxValue,
            teachers_json: JSON.stringify(subject.teachers),
            assessments_json: JSON.stringify(subject.assessments),
            updated_at: subject.updatedAt,
            content_hash: contentHash(subject),
          },
          { contentHash: contentHash(subject) },
        );
      }

      await search.index({
        kind: 'report_card',
        refId: reportCard.id,
        accountId,
        title: 'Bulletin',
        body: [
          reportCard.generalComment ?? '',
          ...subjects.map((subject) => `${subject.subjectName}: ${subject.assessments.join(' ')}`),
        ].join('\n'),
      });
      return stats;
    },

    async saveEvaluations(accountId: string, evaluations: Evaluation[], periodId: string | null, complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      for (const evaluation of evaluations) {
        const hash = contentHash(evaluation);
        const outcome = await upsert(
          db,
          'evaluations',
          {
            id: evaluation.id,
            account_id: accountId,
            native_id: evaluation.nativeId,
            period_id: periodId,
            subject_id: evaluation.subjectId,
            subject_name: evaluation.subjectName,
            name: evaluation.name,
            teacher: evaluation.teacher,
            coefficient: evaluation.coefficient,
            description: evaluation.description,
            evaluated_at: evaluation.evaluatedAt,
            levels_json: JSON.stringify(evaluation.levels),
            skills_json: JSON.stringify(evaluation.skills),
            updated_at: evaluation.updatedAt,
            synced_at: evaluation.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'evaluation',
            refId: evaluation.id,
            accountId,
            title: `${evaluation.subjectName} — ${evaluation.name}`,
            body: evaluation.description,
          });
        }
      }
      if (complete) {
        const rows = await db.all<{ id: string }>(
          'SELECT id FROM evaluations WHERE account_id = ? AND (period_id IS ? OR ? IS NULL)',
          [accountId, periodId, periodId],
        );
        const keep = new Set(evaluations.map((evaluation) => evaluation.id));
        stats.removed = await deleteByIds(db, 'evaluations', rows.map((row) => row.id).filter((id) => !keep.has(id)));
      }
      return stats;
    },

    async saveHomework(accountId: string, homework: Homework[], complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      // "Done" is also a local mark: PRONOTE does not own this state for the app, so a
      // re-sync must never un-tick something the student ticked here.
      const stored = await db.all<{ native_id: string; done: number }>(
        'SELECT native_id, done FROM homework WHERE account_id = ?',
        [accountId],
      );
      const doneLocally = new Map(stored.map((row) => [row.native_id, row.done === 1]));
      for (const item of homework) {
        const hash = contentHash(item);
        const outcome = await upsert(
          db,
          'homework',
          {
            id: item.id,
            account_id: accountId,
            native_id: item.nativeId,
            subject_id: item.subjectId,
            subject_name: item.subjectName,
            description: item.description,
            deadline: item.deadline,
            done: fromBoolean(item.done || (doneLocally.get(item.nativeId) ?? false)),
            difficulty: item.difficulty,
            estimated_minutes: item.estimatedMinutes,
            themes_json: JSON.stringify(item.themes),
            return_kind: item.returnKind,
            resource_id: item.resourceId,
            attachments_json: JSON.stringify(item.attachments),
            updated_at: item.updatedAt,
            synced_at: item.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'homework',
            refId: item.id,
            accountId,
            title: `${item.subjectName} — échéance ${item.deadline.slice(0, 10)}`,
            body: item.description,
          });
          for (const attachment of item.attachments) {
            await saveAttachment(accountId, 'homework', item.id, attachment);
          }
        }
      }
      if (complete) {
        const rows = await db.all<{ id: string }>('SELECT id FROM homework WHERE account_id = ?', [accountId]);
        const keep = new Set(homework.map((item) => item.id));
        stats.removed = await deleteByIds(db, 'homework', rows.map((row) => row.id).filter((id) => !keep.has(id)));
      }
      return stats;
    },

    async saveDiscussions(accountId: string, discussions: Discussion[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const discussion of discussions) {
        const hash = contentHash(discussion);
        tally(
          stats,
          await upsert(
            db,
            'discussions',
            {
              id: discussion.id,
              account_id: accountId,
              native_id: discussion.nativeId,
              subject: discussion.subject,
              creator: discussion.creator,
              last_message_at: discussion.lastMessageAt,
              message_count: discussion.messageCount,
              unread_count: discussion.unreadCount,
              closed: fromBoolean(discussion.closed),
              participants_json: JSON.stringify(discussion.participants),
              updated_at: discussion.updatedAt,
              synced_at: discussion.syncedAt,
              content_hash: hash,
            },
            { contentHash: hash },
          ),
        );
      }
      return stats;
    },

    async saveMessages(accountId: string, discussionId: string, messages: Message[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const message of messages) {
        const hash = contentHash(message);
        const outcome = await upsert(
          db,
          'messages',
          {
            id: message.id,
            account_id: accountId,
            discussion_id: discussionId,
            native_id: message.nativeId,
            author_name: message.authorName,
            author_kind: message.authorKind,
            content_text: message.contentText,
            sent_at: message.sentAt,
            unread: fromBoolean(message.unread),
            attachments_json: JSON.stringify(message.attachments),
            updated_at: message.updatedAt,
            synced_at: message.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'message',
            refId: message.id,
            accountId,
            title: `${message.authorName ?? 'Message'} — ${message.sentAt.slice(0, 10)}`,
            body: message.contentText,
          });
          for (const attachment of message.attachments) {
            await saveAttachment(accountId, 'message', message.id, attachment);
          }
        }
      }
      return stats;
    },

    async saveTimetable(accountId: string, classes: TimetableClass[], windowStart: string, windowEnd: string): Promise<WriteStats> {
      const stats = emptyStats();
      for (const entry of classes) {
        const hash = contentHash(entry);
        const outcome = await upsert(
          db,
          'timetable',
          {
            id: entry.id,
            account_id: accountId,
            native_id: entry.nativeId,
            kind: entry.kind,
            subject_id: entry.subjectId,
            subject_name: entry.subjectName,
            title: entry.title,
            starts_at: entry.startsAt,
            ends_at: entry.endsAt,
            canceled: fromBoolean(entry.canceled),
            exempted: fromBoolean(entry.exempted),
            is_test: fromBoolean(entry.isTest),
            status: entry.status,
            teachers_json: JSON.stringify(entry.teachers),
            rooms_json: JSON.stringify(entry.rooms),
            groups_json: JSON.stringify(entry.groups),
            virtual_classrooms_json: JSON.stringify(entry.virtualClassrooms),
            resource_id: entry.resourceId,
            updated_at: entry.updatedAt,
            synced_at: entry.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
      }
      const rows = await db.all<{ id: string }>(
        'SELECT id FROM timetable WHERE account_id = ? AND starts_at >= ? AND starts_at < ?',
        [accountId, windowStart, windowEnd],
      );
      const keep = new Set(classes.map((entry) => entry.id));
      stats.removed = await deleteByIds(db, 'timetable', rows.map((row) => row.id).filter((id) => !keep.has(id)));
      return stats;
    },

    async saveEvents(accountId: string, events: SchoolEvent[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const event of events) {
        const hash = contentHash(event);
        tally(
          stats,
          await upsert(
            db,
            'events',
            {
              id: event.id,
              account_id: accountId,
              native_id: event.nativeId,
              kind: event.kind,
              title: event.title,
              starts_at: event.startsAt,
              ends_at: event.endsAt,
              description: event.description,
              source: event.source,
              updated_at: event.updatedAt,
              synced_at: event.syncedAt,
              content_hash: hash,
            },
            { contentHash: hash },
          ),
        );
      }
      return stats;
    },

    async saveAbsences(accountId: string, absences: Absence[], complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      for (const absence of absences) {
        const hash = contentHash(absence);
        tally(
          stats,
          await upsert(
            db,
            'absences',
            {
              id: absence.id,
              account_id: accountId,
              native_id: absence.nativeId,
              kind: absence.kind,
              starts_at: absence.startsAt,
              ends_at: absence.endsAt,
              minutes: absence.minutes,
              days_missed: absence.daysMissed,
              justified: fromBoolean(absence.justified),
              reason: absence.reason,
              should_parents_justify: fromBoolean(absence.shouldParentsJustify),
              administratively_fixed: fromBoolean(absence.administrativelyFixed),
              opened: fromBoolean(absence.opened),
              updated_at: absence.updatedAt,
              synced_at: absence.syncedAt,
              content_hash: hash,
            },
            { contentHash: hash },
          ),
        );
      }
      if (complete) {
        const rows = await db.all<{ id: string }>('SELECT id FROM absences WHERE account_id = ?', [accountId]);
        const keep = new Set(absences.map((absence) => absence.id));
        stats.removed = await deleteByIds(db, 'absences', rows.map((row) => row.id).filter((id) => !keep.has(id)));
      }
      return stats;
    },

    async saveNews(accountId: string, items: SchoolNewsItem[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const item of items) {
        const hash = contentHash(item);
        const outcome = await upsert(
          db,
          'school_news',
          {
            id: item.id,
            account_id: accountId,
            native_id: item.nativeId,
            title: item.title,
            category: item.category,
            author: item.author,
            published_at: item.publishedAt,
            starts_at: item.startsAt,
            ends_at: item.endsAt,
            is_read: fromBoolean(item.isRead),
            is_survey: fromBoolean(item.isSurvey),
            body_text: item.bodyText,
            updated_at: item.updatedAt,
            synced_at: item.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'news',
            refId: item.id,
            accountId,
            title: item.title,
            body: [item.category, item.author, item.bodyText ?? ''].join('\n'),
          });
        }
      }
      return stats;
    },

    async saveCanteenMenus(accountId: string, menus: CanteenMenu[]): Promise<WriteStats> {
      const stats = emptyStats();
      for (const menu of menus) {
        const hash = contentHash(menu);
        tally(
          stats,
          await upsert(
            db,
            'canteen_menus',
            {
              id: menu.id,
              account_id: accountId,
              menu_date: menu.menuDate,
              meal: menu.meal,
              courses_json: JSON.stringify(menu.courses),
              allergens_json: JSON.stringify(menu.allergens),
              updated_at: menu.updatedAt,
              synced_at: menu.syncedAt,
              content_hash: hash,
            },
            { contentHash: hash },
          ),
        );
      }
      return stats;
    },

    async saveDocuments(accountId: string, documents: SchoolDocument[], complete: boolean): Promise<WriteStats> {
      const stats = emptyStats();
      for (const document of documents) {
        const hash = contentHash(document);
        const outcome = await upsert(
          db,
          'documents',
          {
            id: document.id,
            account_id: accountId,
            native_id: document.nativeId,
            source: document.source,
            title: document.title,
            subject_id: document.subjectId,
            subject_name: document.subjectName,
            category: document.category,
            description_text: document.descriptionText,
            starts_at: document.startsAt,
            ends_at: document.endsAt,
            updated_at: document.updatedAt,
            synced_at: document.syncedAt,
            content_hash: hash,
          },
          { contentHash: hash },
        );
        tally(stats, outcome);
        if (outcome !== 'unchanged') {
          await search.index({
            kind: 'document',
            refId: document.id,
            accountId,
            title: document.title || document.subjectName || 'Document',
            body: document.descriptionText,
          });
        }
      }
      if (complete) {
        const rows = await db.all<{ id: string }>('SELECT id FROM documents WHERE account_id = ?', [accountId]);
        const keep = new Set(documents.map((document) => document.id));
        stats.removed = await deleteByIds(db, 'documents', rows.map((row) => row.id).filter((id) => !keep.has(id)));
      }
      return stats;
    },

    async setHomeworkDone(accountId: string, homeworkId: string, done: boolean): Promise<void> {
      await db.run('UPDATE homework SET done = ?, updated_at = ? WHERE account_id = ? AND id = ?', [
        fromBoolean(done),
        new Date().toISOString(),
        accountId,
        homeworkId,
      ]);
    },

    async saveMemory(memory: AiMemory): Promise<void> {
      await upsert(
        db,
        'ai_memories',
        {
          id: memory.id,
          account_id: memory.accountId,
          scope: memory.scope,
          mem_key: memory.key,
          value_text: memory.value,
          source: memory.source,
          confidence: memory.confidence,
          conversation_id: memory.conversationId,
          created_at: memory.createdAt,
          updated_at: memory.updatedAt,
          expires_at: memory.expiresAt,
        },
        { contentHash: contentHash(memory) },
      );
      await search.index({
        kind: 'memory',
        refId: memory.id,
        accountId: memory.accountId ?? '',
        title: memory.key,
        body: memory.value,
      });
    },

    async deleteMemory(id: string): Promise<void> {
      await db.run('DELETE FROM ai_memories WHERE id = ?', [id]);
      await search.removeByRef(id);
    },

    async clearMemories(accountId: string, scope?: AiMemory['scope']): Promise<number> {
      const rows = await db.all<{ id: string }>(
        `SELECT id FROM ai_memories WHERE account_id = ?${scope ? ' AND scope = ?' : ''}`,
        scope ? [accountId, scope] : [accountId],
      );
      await db.run(
        `DELETE FROM ai_memories WHERE account_id = ?${scope ? ' AND scope = ?' : ''}`,
        scope ? [accountId, scope] : [accountId],
      );
      for (const row of rows) await search.removeByRef(row.id);
      return rows.length;
    },

    async listMemories(accountId: string): Promise<AiMemory[]> {
      const rows = await db.all<{
        id: string;
        account_id: string | null;
        scope: string;
        mem_key: string;
        value_text: string;
        source: string;
        confidence: number | null;
        conversation_id: string | null;
        created_at: string;
        updated_at: string;
        expires_at: string | null;
      }>('SELECT * FROM ai_memories WHERE account_id = ? ORDER BY updated_at DESC', [accountId]);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        scope: row.scope as AiMemory['scope'],
        key: row.mem_key,
        value: row.value_text,
        source: row.source as AiMemory['source'],
        confidence: row.confidence,
        conversationId: row.conversation_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      }));
    },
  };
}

export type SchoolWriter = ReturnType<typeof createSchoolWriter>;

export function parseAttachments(raw: string | null): { id: string; name: string; url: string; kind: number }[] {
  return parseJsonArray(raw, [] as { id: string; name: string; url: string; kind: number }[]);
}
