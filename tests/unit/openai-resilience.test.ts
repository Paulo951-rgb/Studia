import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiProvider } from '@/providers/ai/openai';
import { runAgentTurn, type AiProvider, type ProviderEvent, type ProviderRequest } from '@/core/ai/provider';
import { TOOLS } from '@/core/ai/tools';
import type { ToolRunner } from '@/core/ai/toolRunner';

function request(): ProviderRequest {
  return {
    model: 'gpt-4.1-mini',
    instructions: 'test',
    input: [{ role: 'user', content: 'Bonjour' }],
    tools: TOOLS,
    store: false,
  };
}

async function collect(iterable: AsyncIterable<ProviderEvent>): Promise<ProviderEvent[]> {
  const events: ProviderEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

test('a fetch implementation without streams replays the request as JSON', async () => {
  const bodies: string[] = [];
  const payload = {
    id: 'resp_plain',
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'Réponse non streamée' }] }],
    usage: { input_tokens: 12, output_tokens: 4 },
  };
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: (async (_url: string, init?: { body?: string }) => {
      bodies.push(String(init?.body ?? ''));
      return {
        ok: true,
        status: 200,
        body: null,
        json: async () => payload,
      } as unknown as Response;
    }) as unknown as typeof fetch,
  });

  const events = await collect(provider.stream(request()));
  const text = events
    .filter((event) => event.type === 'text_delta')
    .map((event) => (event as { delta: string }).delta)
    .join('');
  assert.equal(text, 'Réponse non streamée');

  assert.equal(bodies.length, 2, 'the request is sent once as SSE then replayed as JSON');
  assert.equal(JSON.parse(bodies[0] ?? '{}').stream, true);
  assert.equal(JSON.parse(bodies[1] ?? '{}').stream, false);

  const completed = events.find((event) => event.type === 'completed') as { usage?: { inputTokens: number } };
  assert.equal(completed?.usage?.inputTokens, 12);
});

test('an exhausted quota on HTTP 429 is not reported as a rate limit', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: (async () =>
      ({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } }),
      }) as unknown as Response) as unknown as typeof fetch,
  });

  const events = await collect(provider.stream(request()));
  const error = events.find((event) => event.type === 'error') as { code: string; retryable: boolean };
  assert.equal(error.code, 'quota_exceeded');
  assert.equal(error.retryable, false);
});

test('a silent provider is aborted by the request timeout', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    timeoutMs: 20,
    fetchImpl: ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as unknown as typeof fetch,
  });

  const events = await collect(provider.stream(request()));
  const error = events.find((event) => event.type === 'error') as { code: string };
  assert.equal(error.code, 'timeout');
});

test('the stop button still reports a cancellation, not a timeout', async () => {
  const controller = new AbortController();
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    timeoutMs: 60_000,
    fetchImpl: ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as unknown as typeof fetch,
  });

  const iterator = provider.stream(request(), controller.signal)[Symbol.asyncIterator]();
  const pending = iterator.next();
  controller.abort();
  const first = await pending;
  const value = first.value as { type: string; code?: string };
  assert.equal(value.type, 'error');
  assert.equal(value.code, 'cancelled');
});

test('an exhausted tool-round budget is reported instead of an empty answer', async () => {
  const provider: AiProvider = {
    id: 'stub',
    async *stream(): AsyncIterable<ProviderEvent> {
      yield { type: 'function_call', callId: 'call_1', name: 'get_student_profile', arguments: '{}' };
      yield { type: 'completed', responseId: 'resp_x', usage: { inputTokens: 5, outputTokens: 2 } };
    },
  };
  const runner: ToolRunner = {
    async run() {
      return { ok: true, data: '{}' };
    },
  };

  const result = await runAgentTurn({
    provider,
    runner,
    model: 'gpt-4.1-mini',
    instructions: 'test',
    history: [],
    userMessage: 'Bonjour',
    tools: TOOLS,
    maxToolRounds: 2,
  });

  assert.equal(result.errorCode, 'tool_round_limit');
  assert.equal(result.toolCalls.length, 2);
  assert.equal(result.usage?.inputTokens, 10);
  assert.equal(result.usage?.outputTokens, 4);
});
