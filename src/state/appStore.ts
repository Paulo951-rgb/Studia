import { create } from 'zustand';
import type { Repositories } from '@/db';
import type { Account, ChatMessage } from '@/core/domain/types';
import type { SyncSummary } from '@/core/sync/engine';
import { getRepositories } from '@/platform/database';
import { EncryptionUnavailableError } from '@/db/expoDriver';
import { createConversation, sendChatTurn, getModel } from '@/providers/ai/service';
import { syncAccount } from '@/providers/pronote/service';
import { makeId } from '@/core/util/ids';

type AppStatus = 'booting' | 'ready' | 'fatal';

type AppState = {
  status: AppStatus;
  fatalMessage: string | null;
  repos: Repositories | null;
  accounts: Account[];
  activeAccountId: string | null;
  conversationId: string | null;
  messages: ChatMessage[];
  streamingText: string;
  streaming: boolean;
  toolActivity: string | null;
  syncRunning: boolean;
  lastSyncAt: string | null;
  lastSyncSummary: SyncSummary | null;
  lastError: string | null;
  model: string;
  bootstrap: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;
  startNewConversation: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  cancel: () => void;
  syncNow: (kind: 'initial' | 'manual' | 'incremental') => Promise<void>;
  clearError: () => void;
};

let currentController: AbortController | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  status: 'booting',
  fatalMessage: null,
  repos: null,
  accounts: [],
  activeAccountId: null,
  conversationId: null,
  messages: [],
  streamingText: '',
  streaming: false,
  toolActivity: null,
  syncRunning: false,
  lastSyncAt: null,
  lastSyncSummary: null,
  lastError: null,
  model: 'gpt-4.1-mini',

  async bootstrap() {
    try {
      const repos = await getRepositories();
      const accounts = await repos.accounts.list();
      const storedAccount = await repos.settings.get('active.account');
      const activeAccountId = accounts.find((account) => account.id === storedAccount)?.id ?? accounts[0]?.id ?? null;
      const model = await getModel(repos);
      const lastSyncAt = activeAccountId ? (accounts.find((account) => account.id === activeAccountId)?.lastSyncAt ?? null) : null;

      set({
        status: 'ready',
        repos,
        accounts,
        activeAccountId,
        model,
        lastSyncAt,
        fatalMessage: null,
      });

      const storedConversation = await repos.settings.get('active.conversation');
      const conversations = await repos.chat.listConversations(50);
      const conversation = conversations.find((entry) => entry.id === storedConversation) ?? conversations[0];
      if (conversation) {
        const messages = await repos.chat.listMessages(conversation.id, 200);
        set({ conversationId: conversation.id, messages });
      }

      void maybeSyncOnOpen(get, set);
    } catch (error) {
      if (error instanceof EncryptionUnavailableError) {
        set({ status: 'fatal', fatalMessage: error.message });
        return;
      }
      set({
        status: 'fatal',
        fatalMessage: error instanceof Error ? error.message : 'Impossible d’ouvrir la base locale chiffrée.',
      });
    }
  },

  async refreshAccounts() {
    const repos = get().repos;
    if (!repos) return;
    const accounts = await repos.accounts.list();
    set({ accounts, activeAccountId: get().activeAccountId ?? accounts[0]?.id ?? null });
  },

  async setActiveAccount(accountId) {
    const repos = get().repos;
    if (!repos) return;
    await repos.settings.set('active.account', accountId);
    const account = get().accounts.find((entry) => entry.id === accountId);
    set({ activeAccountId: accountId, lastSyncAt: account?.lastSyncAt ?? null });
  },

  async startNewConversation() {
    const repos = get().repos;
    if (!repos) return;
    const id = await createConversation(repos, { accountId: get().activeAccountId });
    await repos.settings.set('active.conversation', id);
    set({ conversationId: id, messages: [], streamingText: '', lastError: null });
  },

  async openConversation(conversationId) {
    const repos = get().repos;
    if (!repos) return;
    const messages = await repos.chat.listMessages(conversationId, 200);
    await repos.settings.set('active.conversation', conversationId);
    set({ conversationId, messages, streamingText: '' });
  },

  async send(text) {
    const repos = get().repos;
    if (!repos) return;
    if (get().streaming) return;
    let conversationId = get().conversationId;
    if (!conversationId) {
      conversationId = await createConversation(repos, { accountId: get().activeAccountId, title: text.slice(0, 60) });
      await repos.settings.set('active.conversation', conversationId);
      set({ conversationId });
    }

    const controller = new AbortController();
    currentController = controller;

    set({
      streaming: true,
      streamingText: '',
      toolActivity: null,
      lastError: null,
      messages: [
        ...get().messages,
        {
          id: makeId('local', String(Date.now())),
          conversationId,
          role: 'user',
          contentText: text,
          toolCalls: null,
          toolCallId: null,
          toolName: null,
          status: 'complete',
          errorCode: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await sendChatTurn({
      repos,
      accountId: get().activeAccountId,
      conversationId,
      text,
      signal: controller.signal,
      onTextDelta: (delta) => set({ streamingText: get().streamingText + delta }),
      onToolStart: (call) => set({ toolActivity: call.name }),
      onToolEnd: () => set({ toolActivity: null }),
    });

    currentController = null;
    const messages = await repos.chat.listMessages(conversationId, 200);
    set({
      streaming: false,
      streamingText: '',
      toolActivity: null,
      messages,
      lastError: result.errorCode,
    });

    if (result.requiresConsent) set({ lastError: 'consent_required' });
  },

  cancel() {
    currentController?.abort();
    currentController = null;
    set({ streaming: false, streamingText: '', toolActivity: null });
  },

  async syncNow(kind) {
    const { repos, activeAccountId } = get();
    if (!repos || !activeAccountId) return;
    if (get().syncRunning) return;
    set({ syncRunning: true, lastError: null });
    const summary = await syncAccount(repos, activeAccountId, { kind });
    const accounts = await repos.accounts.list();
    const account = accounts.find((entry) => entry.id === activeAccountId);
    set({
      syncRunning: false,
      lastSyncSummary: summary,
      lastSyncAt: account?.lastSyncAt ?? null,
      accounts,
      lastError: summary.errorCode,
    });
  },

  clearError() {
    set({ lastError: null });
  },
}));

async function maybeSyncOnOpen(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
): Promise<void> {
  const { repos, activeAccountId, lastSyncAt } = get();
  if (!repos || !activeAccountId) return;
  const account = get().accounts.find((entry) => entry.id === activeAccountId);
  if (account?.status === 'expired') return;
  const last = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
  const stale = Date.now() - last > 10 * 60 * 1000;
  if (!stale) return;
  set({ syncRunning: true });
  const summary = await syncAccount(repos, activeAccountId, { kind: 'incremental' });
  const accounts = await repos.accounts.list();
  set({
    syncRunning: false,
    lastSyncSummary: summary,
    lastSyncAt: accounts.find((entry) => entry.id === activeAccountId)?.lastSyncAt ?? null,
    accounts,
  });
}

export function useActiveAccount(): Account | null {
  return useAppStore((state) => state.accounts.find((account) => account.id === state.activeAccountId) ?? null);
}
