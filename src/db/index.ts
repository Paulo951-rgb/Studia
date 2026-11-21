import type { SqlDatabase } from '@/db/driver';
import { applyMigrations, currentSchemaVersion } from '@/db/schema';
import { createAccountsRepo, createSessionsRepo, createSyncRepo } from '@/db/repositories/accounts';
import { createChatRepo, createSettingsRepo } from '@/db/repositories/chat';
import { createSchoolReader } from '@/db/repositories/schoolRead';
import { createSchoolWriter } from '@/db/repositories/schoolWrite';
import { createSearchRepo } from '@/db/repositories/search';

export function createRepositories(db: SqlDatabase) {
  const search = createSearchRepo(db);
  return {
    db,
    search,
    accounts: createAccountsRepo(db),
    sessions: createSessionsRepo(db),
    sync: createSyncRepo(db),
    school: createSchoolReader(db),
    writer: createSchoolWriter(db, search),
    chat: createChatRepo(db, search),
    settings: createSettingsRepo(db),
    async migrate(): Promise<number> {
      return applyMigrations(db);
    },
    async schemaVersion(): Promise<number> {
      return currentSchemaVersion(db);
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
