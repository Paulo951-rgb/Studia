import type { SqlDatabase } from '@/db/driver';

/**
 * Schema migrations, applied in order, each inside a transaction.
 *
 * Rules:
 * - never edit an already-shipped migration, append a new one;
 * - every synced table carries `content_hash` so unchanged rows are not rewritten;
 * - every provider-backed table keeps the provider's `native_id` with a unique
 *   index on (account_id, native_id) so re-syncs cannot duplicate rows.
 */
export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

const TIMESTAMPS = `
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'pronote',
        display_name TEXT NOT NULL,
        school_url TEXT NOT NULL,
        account_kind TEXT NOT NULL,
        resource_id TEXT,
        student_name TEXT,
        class_name TEXT,
        establishment_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_sync_at TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        device_uuid TEXT NOT NULL,
        secret_ref TEXT NOT NULL,
        navigator_identifier TEXT,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        expires_at TEXT,
        invalidated_at TEXT,
        invalid_reason TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id)`,

      `CREATE TABLE IF NOT EXISTS student_profile (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        class_name TEXT,
        establishment_name TEXT NOT NULL,
        profile_picture_url TEXT,
        is_delegate INTEGER NOT NULL DEFAULT 0,
        is_director INTEGER NOT NULL DEFAULT 0,
        is_member_ca INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS school_periods (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS school_periods_account_idx ON school_periods(account_id, start_date)`,

      `CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        name TEXT NOT NULL,
        in_groups INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,

      `CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        period_id TEXT REFERENCES school_periods(id) ON DELETE SET NULL,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT NOT NULL,
        value_points REAL,
        value_kind INTEGER NOT NULL,
        out_of_points REAL,
        coefficient REAL NOT NULL DEFAULT 1,
        graded_at TEXT NOT NULL,
        class_average REAL,
        class_min REAL,
        class_max REAL,
        comment TEXT NOT NULL DEFAULT '',
        comment_on_grade TEXT,
        is_bonus INTEGER NOT NULL DEFAULT 0,
        is_optional INTEGER NOT NULL DEFAULT 0,
        is_out_of_20 INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS grades_period_idx ON grades(account_id, period_id, subject_id)`,
      `CREATE INDEX IF NOT EXISTS grades_date_idx ON grades(account_id, graded_at)`,

      `CREATE TABLE IF NOT EXISTS averages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        period_id TEXT NOT NULL REFERENCES school_periods(id) ON DELETE CASCADE,
        subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
        student_value REAL,
        class_value REAL,
        min_value REAL,
        max_value REAL,
        out_of REAL,
        source TEXT NOT NULL,
        computed_at TEXT NOT NULL,
        synced_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS averages_subject_uq
        ON averages(account_id, period_id, subject_id) WHERE subject_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS averages_overall_uq
        ON averages(account_id, period_id) WHERE subject_id IS NULL`,

      `CREATE TABLE IF NOT EXISTS report_cards (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        period_id TEXT NOT NULL REFERENCES school_periods(id) ON DELETE CASCADE,
        general_comment TEXT,
        overall_assessments_json TEXT NOT NULL DEFAULT '[]',
        source_url TEXT,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, period_id)
      )`,

      `CREATE TABLE IF NOT EXISTS report_card_subjects (
        id TEXT PRIMARY KEY,
        report_card_id TEXT NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT NOT NULL,
        subject_group TEXT NOT NULL DEFAULT '',
        coefficient REAL NOT NULL DEFAULT 1,
        student_average REAL,
        class_average REAL,
        min_value REAL,
        max_value REAL,
        teachers_json TEXT NOT NULL DEFAULT '[]',
        assessments_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(report_card_id, subject_name)
      )`,

      `CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        period_id TEXT REFERENCES school_periods(id) ON DELETE SET NULL,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT NOT NULL,
        name TEXT NOT NULL,
        teacher TEXT NOT NULL DEFAULT '',
        coefficient REAL NOT NULL DEFAULT 1,
        description TEXT NOT NULL DEFAULT '',
        evaluated_at TEXT NOT NULL,
        levels_json TEXT NOT NULL DEFAULT '[]',
        skills_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,

      `CREATE TABLE IF NOT EXISTS homework (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        deadline TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        difficulty INTEGER,
        estimated_minutes INTEGER,
        themes_json TEXT NOT NULL DEFAULT '[]',
        return_kind INTEGER,
        resource_id TEXT,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS homework_deadline_idx ON homework(account_id, deadline)`,

      `CREATE TABLE IF NOT EXISTS discussions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        creator TEXT,
        last_message_at TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        unread_count INTEGER NOT NULL DEFAULT 0,
        closed INTEGER NOT NULL DEFAULT 0,
        participants_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,

      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        author_name TEXT,
        author_kind TEXT,
        content_text TEXT NOT NULL DEFAULT '',
        sent_at TEXT NOT NULL,
        unread INTEGER NOT NULL DEFAULT 0,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(discussion_id, sent_at)`,

      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        kind INTEGER,
        mime TEXT,
        size_bytes INTEGER,
        local_path TEXT,
        sha256 TEXT,
        fetched_at TEXT,
        updated_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, owner_type, owner_id, name)
      )`,
      `CREATE INDEX IF NOT EXISTS attachments_owner_idx ON attachments(owner_type, owner_id)`,

      `CREATE TABLE IF NOT EXISTS timetable (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT,
        title TEXT NOT NULL DEFAULT '',
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        canceled INTEGER NOT NULL DEFAULT 0,
        exempted INTEGER NOT NULL DEFAULT 0,
        is_test INTEGER NOT NULL DEFAULT 0,
        status TEXT,
        teachers_json TEXT NOT NULL DEFAULT '[]',
        rooms_json TEXT NOT NULL DEFAULT '[]',
        groups_json TEXT NOT NULL DEFAULT '[]',
        virtual_classrooms_json TEXT NOT NULL DEFAULT '[]',
        resource_id TEXT,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS timetable_start_idx ON timetable(account_id, starts_at)`,

      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        description TEXT,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS events_start_idx ON events(account_id, starts_at)`,

      `CREATE TABLE IF NOT EXISTS absences (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        minutes INTEGER,
        days_missed INTEGER,
        justified INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        should_parents_justify INTEGER NOT NULL DEFAULT 0,
        administratively_fixed INTEGER NOT NULL DEFAULT 0,
        opened INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS absences_start_idx ON absences(account_id, starts_at)`,

      `CREATE TABLE IF NOT EXISTS school_news (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL,
        starts_at TEXT,
        ends_at TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        is_survey INTEGER NOT NULL DEFAULT 0,
        body_text TEXT,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS school_news_published_idx ON school_news(account_id, published_at)`,

      `CREATE TABLE IF NOT EXISTS canteen_menus (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        menu_date TEXT NOT NULL,
        meal TEXT NOT NULL,
        courses_json TEXT NOT NULL DEFAULT '[]',
        allergens_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, menu_date, meal)
      )`,

      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        native_id TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT,
        category TEXT,
        description_text TEXT NOT NULL DEFAULT '',
        starts_at TEXT,
        ends_at TEXT,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(account_id, source, native_id)
      )`,
      `CREATE INDEX IF NOT EXISTS documents_subject_idx ON documents(account_id, subject_id)`,

      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        memory_enabled INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations(updated_at)`,

      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content_text TEXT NOT NULL DEFAULT '',
        tool_calls_json TEXT,
        tool_call_id TEXT,
        tool_name TEXT,
        status TEXT NOT NULL DEFAULT 'complete',
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages(conversation_id, created_at)`,

      `CREATE TABLE IF NOT EXISTS ai_memories (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        mem_key TEXT NOT NULL,
        value_text TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL,
        conversation_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        content_hash TEXT NOT NULL DEFAULT '',
        UNIQUE(account_id, scope, mem_key)
      )`,

      `CREATE TABLE IF NOT EXISTS sync_history (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        resources_json TEXT NOT NULL DEFAULT '{}',
        error_code TEXT,
        error_message TEXT,
        duration_ms INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS sync_history_started_idx ON sync_history(account_id, started_at)`,

      `CREATE TABLE IF NOT EXISTS sync_state (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        cursor TEXT,
        last_synced_at TEXT,
        last_error TEXT,
        PRIMARY KEY (account_id, resource)
      )`,

      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      `CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        kind,
        ref_id UNINDEXED,
        account_id UNINDEXED,
        title,
        body,
        tokenize = 'unicode61 remove_diacritics 2',
        prefix = '2 3 4'
      )`,
    ],
  },
  {
    version: 2,
    name: 'ai-usage-and-hot-indexes',
    statements: [
      // Token accounting stays local: the key belongs to the user, so the cost
      // estimate must be visible to them without any telemetry.
      `CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        estimated_cost_usd REAL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at)`,
      `CREATE INDEX IF NOT EXISTS ai_usage_account_idx ON ai_usage(account_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS canteen_menus_date_idx ON canteen_menus(account_id, menu_date)`,
      `CREATE INDEX IF NOT EXISTS documents_dates_idx ON documents(account_id, starts_at)`,
      `CREATE INDEX IF NOT EXISTS messages_sent_idx ON messages(discussion_id, sent_at)`,
      `CREATE INDEX IF NOT EXISTS ai_memories_account_idx ON ai_memories(account_id, scope)`,
    ],
  },
];

export async function applyMigrations(db: SqlDatabase, migrations: Migration[] = MIGRATIONS): Promise<number> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const rows = await db.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  const applied = new Set(rows.map((row) => row.version));
  let count = 0;

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    await db.transaction(async () => {
      for (const statement of migration.statements) {
        await db.exec(statement);
      }
      await db.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
    });
    count += 1;
  }

  return count;
}

export async function currentSchemaVersion(db: SqlDatabase): Promise<number> {
  const rows = await db.all<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );
  return rows[0]?.version ?? 0;
}

export const SCHEMA_VERSION = MIGRATIONS.length;
