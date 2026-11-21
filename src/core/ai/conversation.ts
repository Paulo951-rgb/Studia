import type { ChatMessage } from '@/core/domain/types';

export type RegenerationPlan = {
  /** Question to send again. */
  text: string;
  /** Trailing messages to drop, so the stored turn is not duplicated. */
  deleteIds: string[];
};

/**
 * Regeneration replays the last question. The trailing turn (question and its
 * answer) is removed first: otherwise the persisted history would contain the
 * question twice and the model would see a duplicated turn.
 */
export function planRegeneration(messages: ChatMessage[]): RegenerationPlan | null {
  let index = -1;
  for (let cursor = messages.length - 1; cursor >= 0; cursor -= 1) {
    const message = messages[cursor];
    if (message && message.role === 'user' && message.contentText.trim().length > 0) {
      index = cursor;
      break;
    }
  }
  if (index === -1) return null;
  const question = messages[index];
  if (!question) return null;
  return {
    text: question.contentText,
    deleteIds: messages.slice(index).map((message) => message.id),
  };
}
