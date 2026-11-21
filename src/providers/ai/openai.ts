import { createSseParser } from '@/core/ai/sse';
import type { AiErrorCode, AiProvider, ProviderEvent, ProviderRequest } from '@/core/ai/provider';

/**
 * OpenAI Responses API client (`POST /v1/responses`).
 *
 * Notes that matter for a mobile client:
 * - `store: false` is always sent: OpenAI does not keep the response for later
 *   retrieval. It does not remove abuse-monitoring retention, which is documented
 *   to the user in the privacy screen.
 * - the key lives in the device keychain, is never logged and never leaves the
 *   device except in the Authorization header of these calls;
 * - streaming requires a fetch implementation that exposes a readable body. React
 *   Native's default fetch does not, so the app injects `expo/fetch` and this client
 *   falls back to a single-shot request when the body cannot be streamed.
 */

export type OpenAiProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl: typeof fetch;
  /** Injected for tests. */
  now?: () => number;
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class OpenAiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  constructor(code: AiErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'OpenAiProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** Removes anything that looks like an API key from provider messages before display. */
export function redactSecrets(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_\-]{8,}/g, 'sk-***');
}

function mapStatus(status: number): { code: AiErrorCode; retryable: boolean } {
  if (status === 401 || status === 403) return { code: 'invalid_api_key', retryable: false };
  if (status === 429) return { code: 'rate_limited', retryable: true };
  if (status === 400 || status === 404 || status === 422) return { code: 'bad_request', retryable: false };
  if (status >= 500) return { code: 'server_error', retryable: true };
  return { code: 'unknown', retryable: false };
}

function buildRequestBody(request: ProviderRequest, stream: boolean): Record<string, unknown> {
  return {
    model: request.model,
    instructions: request.instructions,
    input: request.input.map((item) => {
      if ('type' in item) {
        return { type: 'function_call_output', call_id: item.call_id, output: item.output };
      }
      return { role: item.role, content: item.content };
    }),
    tools: request.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: true,
    })),
    store: false,
    stream,
    ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
  };
}

type StreamState = {
  text: string;
  calls: Map<string, { callId: string; name: string; arguments: string }>;
  responseId: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null } | undefined;
};

function handleStreamEvent(rawEvent: string | null, payload: Record<string, unknown>, state: StreamState): ProviderEvent[] {
  const type = (payload['type'] as string | undefined) ?? rawEvent ?? '';
  const events: ProviderEvent[] = [];

  switch (type) {
    case 'response.output_text.delta': {
      const delta = payload['delta'];
      if (typeof delta === 'string' && delta.length > 0) {
        state.text += delta;
        events.push({ type: 'text_delta', delta });
      }
      break;
    }
    case 'response.output_item.added': {
      const item = payload['item'] as Record<string, unknown> | undefined;
      if (item?.['type'] === 'function_call' && typeof item['call_id'] === 'string') {
        state.calls.set(item['call_id'], {
          callId: item['call_id'],
          name: typeof item['name'] === 'string' ? item['name'] : '',
          arguments: typeof item['arguments'] === 'string' ? item['arguments'] : '',
        });
      }
      break;
    }
    case 'response.function_call_arguments.delta': {
      const callId = payload['item_id'] as string | undefined;
      const delta = payload['delta'];
      if (callId && typeof delta === 'string') {
        const existing = state.calls.get(callId);
        if (existing) existing.arguments += delta;
        else state.calls.set(callId, { callId, name: '', arguments: delta });
      }
      break;
    }
    case 'response.output_item.done': {
      const item = payload['item'] as Record<string, unknown> | undefined;
      if (item?.['type'] === 'function_call') {
        const callId = typeof item['call_id'] === 'string' ? item['call_id'] : String(item['id'] ?? '');
        const name = typeof item['name'] === 'string' ? item['name'] : '';
        const args = typeof item['arguments'] === 'string' ? item['arguments'] : '';
        const existing = state.calls.get(callId);
        state.calls.set(callId, { callId, name: name || existing?.name || '', arguments: args || existing?.arguments || '' });
      }
      break;
    }
    case 'response.completed': {
      const response = payload['response'] as Record<string, unknown> | undefined;
      state.responseId = typeof response?.['id'] === 'string' ? response['id'] : state.responseId;
      const usage = response?.['usage'] as Record<string, unknown> | undefined;
      if (usage) {
        state.usage = {
          inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : null,
          outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : null,
        };
      }
      break;
    }
    case 'response.failed': {
      const response = payload['response'] as Record<string, unknown> | undefined;
      const error = response?.['error'] as Record<string, unknown> | undefined;
      const code = error?.['code'];
      events.push({
        type: 'error',
        code: code === 'rate_limit_exceeded' ? 'rate_limited' : code === 'insufficient_quota' ? 'quota_exceeded' : 'server_error',
        message: typeof error?.['message'] === 'string' ? redactSecrets(error['message']) : 'La génération a échoué.',
        retryable: code === 'rate_limit_exceeded' || code === 'insufficient_quota',
      });
      break;
    }
    case 'error': {
      const code = payload['code'];
      events.push({
        type: 'error',
        code: code === 'rate_limit_exceeded' ? 'rate_limited' : 'server_error',
        message: typeof payload['message'] === 'string' ? redactSecrets(payload['message']) : 'Erreur du fournisseur.',
        retryable: true,
      });
      break;
    }
    default:
      break;
  }

  return events;
}

function parseNonStreamingResponse(payload: Record<string, unknown>, state: StreamState): ProviderEvent[] {
  const events: ProviderEvent[] = [];
  const output = Array.isArray(payload['output']) ? (payload['output'] as Record<string, unknown>[]) : [];
  for (const item of output) {
    if (item['type'] === 'message' && Array.isArray(item['content'])) {
      for (const content of item['content'] as Record<string, unknown>[]) {
        if (content['type'] === 'output_text' && typeof content['text'] === 'string') {
          state.text += content['text'];
          events.push({ type: 'text_delta', delta: content['text'] });
        }
      }
    } else if (item['type'] === 'function_call' && typeof item['call_id'] === 'string') {
      state.calls.set(item['call_id'], {
        callId: item['call_id'],
        name: typeof item['name'] === 'string' ? item['name'] : '',
        arguments: typeof item['arguments'] === 'string' ? item['arguments'] : '{}',
      });
    }
  }
  const usage = payload['usage'] as Record<string, unknown> | undefined;
  state.usage = usage
    ? {
        inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : null,
        outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : null,
      }
    : undefined;
  state.responseId = typeof payload['id'] === 'string' ? payload['id'] : null;
  if (typeof payload['error'] === 'object' && payload['error']) {
    const error = payload['error'] as Record<string, unknown>;
    events.push({
      type: 'error',
      code: 'server_error',
      message: typeof error['message'] === 'string' ? redactSecrets(error['message']) : 'Erreur du fournisseur.',
      retryable: false,
    });
  }
  return events;
}

export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  return {
    id: 'openai-responses',
    async *stream(request: ProviderRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent> {
      if (!options.apiKey || options.apiKey.trim().length === 0) {
        yield { type: 'error', code: 'missing_api_key', message: 'Aucune clé API OpenAI enregistrée.', retryable: false };
        return;
      }

      const state: StreamState = { text: '', calls: new Map(), responseId: null, usage: undefined };
      const send = async (stream: boolean): Promise<Response> =>
        options.fetchImpl(`${baseUrl}/responses`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            Accept: stream ? 'text/event-stream' : 'application/json',
          },
          body: JSON.stringify(buildRequestBody(request, stream)),
          ...(signal ? { signal } : {}),
        });

      let response: Response;
      try {
        response = await send(true);
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        yield {
          type: 'error',
          code: aborted ? 'cancelled' : 'network_error',
          message: aborted ? 'Requête annulée.' : 'Impossible de joindre OpenAI (réseau indisponible).',
          retryable: !aborted,
        };
        return;
      }

      if (!response.ok) {
        const mapped = mapStatus(response.status);
        let message = `OpenAI a refusé la requête (HTTP ${response.status}).`;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // Body is not JSON; keep the generic message.
        }
        yield { type: 'error', code: mapped.code, message: redactSecrets(message), retryable: mapped.retryable };
        return;
      }

      const body = response.body as ReadableStream<Uint8Array> | null;
      const canStream = Boolean(body && typeof (body as { getReader?: unknown }).getReader === 'function');

      if (!canStream) {
        // No streaming support in this fetch implementation: single-shot request.
        try {
          const payload = (await response.json()) as Record<string, unknown>;
          for (const event of parseNonStreamingResponse(payload, state)) yield event;
          for (const call of state.calls.values()) {
            yield { type: 'function_call', callId: call.callId, name: call.name, arguments: call.arguments };
          }
          yield { type: 'completed', responseId: state.responseId, ...(state.usage ? { usage: state.usage } : {}) };
        } catch (error) {
          yield {
            type: 'error',
            code: 'stream_interrupted',
            message: error instanceof Error ? error.message : 'Réponse illisible.',
            retryable: true,
          };
        }
        return;
      }

      const reader = body!.getReader();
      const decoder = new TextDecoder();
      const parse = createSseParser();
      let failed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const message of parse(chunk)) {
            let payload: Record<string, unknown>;
            try {
              payload = JSON.parse(message.data) as Record<string, unknown>;
            } catch {
              continue;
            }
            for (const event of handleStreamEvent(message.event, payload, state)) {
              if (event.type === 'error') failed = true;
              yield event;
            }
          }
        }
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        yield {
          type: 'error',
          code: aborted ? 'cancelled' : 'stream_interrupted',
          message: aborted ? 'Requête annulée.' : 'Le flux de réponse a été interrompu.',
          retryable: !aborted,
        };
        return;
      }

      if (failed) return;

      for (const call of state.calls.values()) {
        if (!call.name) continue;
        yield { type: 'function_call', callId: call.callId, name: call.name, arguments: call.arguments || '{}' };
      }
      yield { type: 'completed', responseId: state.responseId, ...(state.usage ? { usage: state.usage } : {}) };
    },
  };
}
