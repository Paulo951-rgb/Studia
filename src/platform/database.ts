import type { SqlDatabase } from '@/db/driver';
import { openExpoDatabase } from '@/db/expoDriver';
import { createRepositories, type Repositories } from '@/db';
import { getOrCreateDatabaseKey } from '@/platform/secureStore';

let repositories: Repositories | null = null;
let database: SqlDatabase | null = null;

export const DATABASE_NAME = 'scolary.db';

/**
 * Opens the encrypted database once per app process.
 *
 * The database key is generated on first launch and kept in the keychain. If the
 * build lacks SQLCipher, `openExpoDatabase` throws: the app must never fall back to
 * plaintext storage of school data.
 */
export async function getRepositories(): Promise<Repositories> {
  if (repositories) return repositories;
  const key = await getOrCreateDatabaseKey();
  database = await openExpoDatabase({ name: DATABASE_NAME, key });
  repositories = createRepositories(database);
  await repositories.migrate();
  return repositories;
}

export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.close();
    database = null;
    repositories = null;
  }
}

/** Deletes every local row. The key is removed separately so the file becomes unreadable. */
export async function wipeDatabase(): Promise<void> {
  const repos = await getRepositories();
  const tables = [
    'chat_messages',
    'conversations',
    'ai_memories',
    'attachments',
    'messages',
    'discussions',
    'documents',
    'canteen_menus',
    'school_news',
    'absences',
    'events',
    'timetable',
    'homework',
    'evaluations',
    'report_card_subjects',
    'report_cards',
    'averages',
    'grades',
    'subjects',
    'school_periods',
    'student_profile',
    'sync_state',
    'sync_history',
    'sessions',
    'settings',
    'accounts',
  ];
  await repos.db.transaction(async () => {
    for (const table of tables) {
      await repos.db.run(`DELETE FROM ${table}`);
    }
    await repos.db.run('DELETE FROM search_index');
  });
  await closeDatabase();
}
