import { createNodeDatabase } from '@/db/nodeDriver';
import { createRepositories, type Repositories } from '@/db';
import { account, maths, french, period, period2, profile } from './fixtures';

export async function createTestRepositories(): Promise<Repositories> {
  const db = createNodeDatabase(':memory:');
  const repos = createRepositories(db);
  await repos.migrate();
  await repos.accounts.save(account);
  return repos;
}

/** Seeds the rows every other table references: profile, periods and subjects. */
export async function seedSchool(repos: Repositories): Promise<void> {
  await repos.writer.saveProfile(profile);
  await repos.writer.savePeriods(account.id, [period, period2], false);
  await repos.writer.saveSubjects(account.id, [maths, french]);
}
