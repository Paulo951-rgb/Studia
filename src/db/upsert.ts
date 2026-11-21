import type { SqlDatabase, SqlParam } from '@/db/driver';

/**
 * Column allow-lists for the generic upsert helper.
 *
 * SQL identifiers are never interpolated from user input: they come from this
 * constant table, and every value is bound.
 */
export const TABLE_COLUMNS: Record<string, readonly string[]> = {
  accounts: [
    'id', 'provider', 'display_name', 'school_url', 'account_kind', 'resource_id', 'student_name',
    'class_name', 'establishment_name', 'status', 'created_at', 'updated_at', 'last_sync_at',
  ],
  sessions: [
    'id', 'account_id', 'device_uuid', 'secret_ref', 'navigator_identifier', 'created_at',
    'last_used_at', 'expires_at', 'invalidated_at', 'invalid_reason',
  ],
  student_profile: [
    'account_id', 'native_id', 'name', 'kind', 'class_name', 'establishment_name',
    'profile_picture_url', 'is_delegate', 'is_director', 'is_member_ca', 'updated_at', 'synced_at',
  ],
  school_periods: [
    'id', 'account_id', 'native_id', 'name', 'kind', 'start_date', 'end_date', 'is_default',
    'updated_at', 'synced_at', 'content_hash',
  ],
  subjects: ['id', 'account_id', 'native_id', 'name', 'in_groups', 'updated_at', 'synced_at', 'content_hash'],
  grades: [
    'id', 'account_id', 'native_id', 'period_id', 'subject_id', 'subject_name', 'value_points',
    'value_kind', 'out_of_points', 'coefficient', 'graded_at', 'class_average', 'class_min',
    'class_max', 'comment', 'comment_on_grade', 'is_bonus', 'is_optional', 'is_out_of_20',
    'updated_at', 'synced_at', 'content_hash',
  ],
  averages: [
    'id', 'account_id', 'period_id', 'subject_id', 'student_value', 'class_value', 'min_value',
    'max_value', 'out_of', 'source', 'computed_at', 'synced_at',
  ],
  report_cards: [
    'id', 'account_id', 'period_id', 'general_comment', 'overall_assessments_json', 'source_url',
    'updated_at', 'synced_at', 'content_hash',
  ],
  report_card_subjects: [
    'id', 'report_card_id', 'account_id', 'subject_id', 'subject_name', 'subject_group',
    'coefficient', 'student_average', 'class_average', 'min_value', 'max_value', 'teachers_json',
    'assessments_json', 'updated_at', 'content_hash',
  ],
  evaluations: [
    'id', 'account_id', 'native_id', 'period_id', 'subject_id', 'subject_name', 'name', 'teacher',
    'coefficient', 'description', 'evaluated_at', 'levels_json', 'skills_json', 'updated_at',
    'synced_at', 'content_hash',
  ],
  homework: [
    'id', 'account_id', 'native_id', 'subject_id', 'subject_name', 'description', 'deadline', 'done',
    'difficulty', 'estimated_minutes', 'themes_json', 'return_kind', 'resource_id',
    'attachments_json', 'updated_at', 'synced_at', 'content_hash',
  ],
  discussions: [
    'id', 'account_id', 'native_id', 'subject', 'creator', 'last_message_at', 'message_count',
    'unread_count', 'closed', 'participants_json', 'updated_at', 'synced_at', 'content_hash',
  ],
  messages: [
    'id', 'account_id', 'discussion_id', 'native_id', 'author_name', 'author_kind', 'content_text',
    'sent_at', 'unread', 'attachments_json', 'updated_at', 'synced_at', 'content_hash',
  ],
  attachments: [
    'id', 'account_id', 'owner_type', 'owner_id', 'name', 'url', 'kind', 'mime', 'size_bytes',
    'local_path', 'sha256', 'fetched_at', 'updated_at', 'content_hash',
  ],
  timetable: [
    'id', 'account_id', 'native_id', 'kind', 'subject_id', 'subject_name', 'title', 'starts_at',
    'ends_at', 'canceled', 'exempted', 'is_test', 'status', 'teachers_json', 'rooms_json',
    'groups_json', 'virtual_classrooms_json', 'resource_id', 'updated_at', 'synced_at',
    'content_hash',
  ],
  events: [
    'id', 'account_id', 'native_id', 'kind', 'title', 'starts_at', 'ends_at', 'description',
    'source', 'updated_at', 'synced_at', 'content_hash',
  ],
  absences: [
    'id', 'account_id', 'native_id', 'kind', 'starts_at', 'ends_at', 'minutes', 'days_missed',
    'justified', 'reason', 'should_parents_justify', 'administratively_fixed', 'opened',
    'updated_at', 'synced_at', 'content_hash',
  ],
  school_news: [
    'id', 'account_id', 'native_id', 'title', 'category', 'author', 'published_at', 'starts_at',
    'ends_at', 'is_read', 'is_survey', 'body_text', 'updated_at', 'synced_at', 'content_hash',
  ],
  canteen_menus: [
    'id', 'account_id', 'menu_date', 'meal', 'courses_json', 'allergens_json', 'updated_at',
    'synced_at', 'content_hash',
  ],
  documents: [
    'id', 'account_id', 'native_id', 'source', 'title', 'subject_id', 'subject_name', 'category',
    'description_text', 'starts_at', 'ends_at', 'updated_at', 'synced_at', 'content_hash',
  ],
  conversations: [
    'id', 'account_id', 'title', 'model', 'memory_enabled', 'archived', 'created_at', 'updated_at',
  ],
  chat_messages: [
    'id', 'conversation_id', 'role', 'content_text', 'tool_calls_json', 'tool_call_id', 'tool_name',
    'status', 'error_code', 'created_at', 'updated_at',
  ],
  ai_memories: [
    'id', 'account_id', 'scope', 'mem_key', 'value_text', 'source', 'confidence', 'conversation_id',
    'created_at', 'updated_at', 'expires_at',
  ],
  sync_history: [
    'id', 'account_id', 'kind', 'started_at', 'finished_at', 'status', 'resources_json',
    'error_code', 'error_message', 'duration_ms',
  ],
  sync_state: ['account_id', 'resource', 'cursor', 'last_synced_at', 'last_error'],
  settings: ['key', 'value', 'updated_at'],
  events_alias: [],
};

export type UpsertOutcome = 'inserted' | 'updated' | 'unchanged';

function assertColumns(table: string, keys: string[]): readonly string[] {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) throw new Error(`Unknown table: ${table}`);
  for (const key of keys) {
    if (!allowed.includes(key)) throw new Error(`Unknown column ${table}.${key}`);
  }
  return allowed;
}

export async function upsert(
  db: SqlDatabase,
  table: string,
  row: Record<string, SqlParam>,
  options: { contentHash?: string; idColumn?: string } = {},
): Promise<UpsertOutcome> {
  const idColumn = options.idColumn ?? 'id';
  const keys = Object.keys(row);
  if (keys.length === 0) throw new Error('Empty row');
  assertColumns(table, keys);

  const id = row[idColumn];
  if (id === undefined || id === null) throw new Error(`${table}.${idColumn} is required`);

  if (options.contentHash !== undefined) {
    const existing = await db.get<{ content_hash: string }>(
      `SELECT content_hash FROM ${table} WHERE ${idColumn} = ?`,
      [id],
    );
    if (existing?.content_hash === options.contentHash) return 'unchanged';
    if (existing) {
      const assignments = keys.filter((key) => key !== idColumn).map((key) => `${key} = ?`);
      const values = keys.filter((key) => key !== idColumn).map((key) => row[key] ?? null);
      await db.run(
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${idColumn} = ?`,
        [...values, id],
      );
      return 'updated';
    }
  }

  const placeholders = keys.map(() => '?').join(', ');
  const updateAssignments = keys
    .filter((key) => key !== idColumn)
    .map((key) => `${key} = excluded.${key}`)
    .join(', ');
  const conflict = updateAssignments
    ? `ON CONFLICT(${idColumn}) DO UPDATE SET ${updateAssignments}`
    : `ON CONFLICT(${idColumn}) DO NOTHING`;
  await db.run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ${conflict}`,
    keys.map((key) => row[key] ?? null),
  );
  return 'inserted';
}

export async function deleteByIds(db: SqlDatabase, table: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  assertColumns(table, ['id']);
  let removed = 0;
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const placeholders = chunk.map(() => '?').join(', ');
    const result = await db.run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, chunk);
    removed += result.changes;
  }
  return removed;
}

/**
 * Removes rows of a provider-backed table that no longer exist upstream.
 * Only call this after a *complete* fetch for the given scope, never after a
 * partial or paginated one.
 */
export async function reconcile(
  db: SqlDatabase,
  table: string,
  scope: { column: string; value: string },
  keepIds: string[],
): Promise<number> {
  assertColumns(table, [scope.column, 'id']);
  const keep = new Set(keepIds);
  const rows = await db.all<{ id: string }>(`SELECT id FROM ${table} WHERE ${scope.column} = ?`, [scope.value]);
  const stale = rows.map((row) => row.id).filter((id) => !keep.has(id));
  return deleteByIds(db, table, stale);
}
