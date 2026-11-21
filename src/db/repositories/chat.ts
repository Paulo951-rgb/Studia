import type { SqlDatabase } from '@/db/driver';
import { parseJsonArray, toBoolean } from '@/db/driver';
import { upsert } from '@/db/upsert';
import type { ChatMessage, Conversation } from '@/core/domain/types';
import type { createSearchRepo } from '@/db/repositories/search';

export function createChatRepo(db: SqlDatabase, search: ReturnType<typeof createSearchRepo>) {
  /** Chat messages are indexed under their conversation's account so account-scoped search finds them. */
  async function indexChatMessage(messageId: string, conversationId: string, role: string, text: string): Promise<void> {
    if (!text.trim()) return;
    const conversation = await db.get<{ account_id: string | null }>(
      'SELECT account_id FROM conversations WHERE id = ?',
      [conversationId],
    );
    await search.index({
      kind: 'chat_message',
      refId: messageId,
      accountId: conversation?.account_id ?? '',
      title: role === 'user' ? 'Vous' : 'Assistant',
      body: text,
    });
  }

  return {
    async createConversation(conversation: Conversation): Promise<void> {
      await upsert(db, 'conversations', {
        id: conversation.id,
        account_id: conversation.accountId,
        title: conversation.title,
        model: conversation.model,
        memory_enabled: conversation.memoryEnabled ? 1 : 0,
        archived: conversation.archived ? 1 : 0,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      });
    },
    async listConversations(limit = 50): Promise<Conversation[]> {
      const rows = await db.all<{
        id: string;
        account_id: string | null;
        title: string;
        model: string;
        memory_enabled: number;
        archived: number;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM conversations WHERE archived = 0 ORDER BY updated_at DESC LIMIT ?', [limit]);
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        title: row.title,
        model: row.model,
        memoryEnabled: toBoolean(row.memory_enabled),
        archived: toBoolean(row.archived),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    async getConversation(id: string): Promise<Conversation | undefined> {
      const row = await db.get<{
        id: string;
        account_id: string | null;
        title: string;
        model: string;
        memory_enabled: number;
        archived: number;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM conversations WHERE id = ?', [id]);
      if (!row) return undefined;
      return {
        id: row.id,
        accountId: row.account_id,
        title: row.title,
        model: row.model,
        memoryEnabled: toBoolean(row.memory_enabled),
        archived: toBoolean(row.archived),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    async renameConversation(id: string, title: string): Promise<void> {
      await db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, new Date().toISOString(), id]);
    },
    async setConversationMemory(id: string, enabled: boolean): Promise<void> {
      await db.run('UPDATE conversations SET memory_enabled = ?, updated_at = ? WHERE id = ?', [
        enabled ? 1 : 0,
        new Date().toISOString(),
        id,
      ]);
    },
    async deleteConversation(id: string): Promise<void> {
      const rows = await db.all<{ id: string }>('SELECT id FROM chat_messages WHERE conversation_id = ?', [id]);
      await db.run('DELETE FROM conversations WHERE id = ?', [id]);
      for (const row of rows) await search.remove('chat_message', row.id);
    },
    async touchConversation(id: string): Promise<void> {
      await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    },
    async addMessage(message: ChatMessage): Promise<void> {
      await upsert(db, 'chat_messages', {
        id: message.id,
        conversation_id: message.conversationId,
        role: message.role,
        content_text: message.contentText,
        tool_calls_json: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        tool_call_id: message.toolCallId,
        tool_name: message.toolName,
        status: message.status,
        error_code: message.errorCode,
        created_at: message.createdAt,
        updated_at: message.createdAt,
      });
      if (message.role === 'user' || message.role === 'assistant') {
        await indexChatMessage(message.id, message.conversationId, message.role, message.contentText);
      }
    },
    async updateMessage(id: string, patch: { contentText?: string; status?: ChatMessage['status']; errorCode?: string | null }): Promise<void> {
      const assignments: string[] = [];
      const params: (string | null)[] = [];
      if (patch.contentText !== undefined) {
        assignments.push('content_text = ?');
        params.push(patch.contentText);
      }
      if (patch.status !== undefined) {
        assignments.push('status = ?');
        params.push(patch.status);
      }
      if (patch.errorCode !== undefined) {
        assignments.push('error_code = ?');
        params.push(patch.errorCode);
      }
      if (assignments.length === 0) return;
      assignments.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      await db.run(`UPDATE chat_messages SET ${assignments.join(', ')} WHERE id = ?`, params);
      if (patch.contentText !== undefined) {
        const row = await db.get<{ conversation_id: string; role: string }>(
          'SELECT conversation_id, role FROM chat_messages WHERE id = ?',
          [id],
        );
        if (row && (row.role === 'user' || row.role === 'assistant')) {
          await indexChatMessage(id, row.conversation_id, row.role, patch.contentText);
        }
      }
    },
    async listMessages(conversationId: string, limit = 200): Promise<ChatMessage[]> {
      const rows = await db.all<{
        id: string;
        conversation_id: string;
        role: string;
        content_text: string;
        tool_calls_json: string | null;
        tool_call_id: string | null;
        tool_name: string | null;
        status: string;
        error_code: string | null;
        created_at: string;
      }>('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?', [
        conversationId,
        limit,
      ]);
      return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role as ChatMessage['role'],
        contentText: row.content_text,
        toolCalls: row.tool_calls_json
          ? parseJsonArray<{ id: string; name: string; arguments: string }>(row.tool_calls_json)
          : null,
        toolCallId: row.tool_call_id,
        toolName: row.tool_name,
        status: row.status as ChatMessage['status'],
        errorCode: row.error_code,
        createdAt: row.created_at,
      }));
    },
    async deleteMessage(id: string): Promise<void> {
      await db.run('DELETE FROM chat_messages WHERE id = ?', [id]);
      await search.remove('chat_message', id);
    },
    async clearAll(): Promise<void> {
      await db.run('DELETE FROM chat_messages');
      await db.run('DELETE FROM conversations');
      await db.run('DELETE FROM search_index');
    },
  };
}

export function createSettingsRepo(db: SqlDatabase) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
      return row?.value ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      await db.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, new Date().toISOString()],
      );
    },
    async remove(key: string): Promise<void> {
      await db.run('DELETE FROM settings WHERE key = ?', [key]);
    },
    async all(): Promise<Record<string, string>> {
      const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },
  };
}
