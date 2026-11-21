import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getRepositories } from '@/platform/database';
import { syncAccount } from '@/providers/pronote/service';

export const BACKGROUND_SYNC_TASK = 'scolary-background-sync';
export const BACKGROUND_SYNC_SETTING = 'sync.background.enabled';

/**
 * Opportunistic refresh. The OS decides when (and whether) it runs, so this is a
 * best-effort complement to the manual and on-open refreshes, never a guarantee.
 */
if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      const repos = await getRepositories();
      if ((await repos.settings.get(BACKGROUND_SYNC_SETTING)) !== 'true') {
        return BackgroundTask.BackgroundTaskResult.Success;
      }
      const accounts = await repos.accounts.list();
      for (const account of accounts) {
        if (account.status !== 'active') continue;
        await syncAccount(repos, account.id, { kind: 'background' });
      }
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function isBackgroundSyncEnabled(): Promise<boolean> {
  const repos = await getRepositories();
  return (await repos.settings.get(BACKGROUND_SYNC_SETTING)) === 'true';
}

export async function setBackgroundSyncEnabled(enabled: boolean): Promise<void> {
  const repos = await getRepositories();
  await repos.settings.set(BACKGROUND_SYNC_SETTING, enabled ? 'true' : 'false');
  if (enabled) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 240 });
  } else if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  }
}
