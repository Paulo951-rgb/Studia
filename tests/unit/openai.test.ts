import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiProvider } from '@/providers/ai/openai';
import type { ProviderEvent, ProviderRequest } from '@/core/ai/provider';
import { TOOLS } from '@/core/ai/tools';

function request(): ProviderRequest {
  return {
    model: 'gpt-4.1-mini',
    instructions: 'test',
    input: [{ role: 'user', content: 'Bonjour' }],
    tools: TOOLS,
    store: false,
  };
}

function streamResponse(body: string, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of body.match(/[\s\S]{1,17}/g) ?? []) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(iterable: AsyncIterable<ProviderEvent>): Promise<ProviderEvent[]> {
  const events: ProviderEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

test('text deltas are streamed and the response completes', async () => {
  const sse = [
    'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1"}}\n\n',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Bon"}\n\n',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"jour"}\n\n',
    'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":10,"output_tokens":2}}}\n\n',
  ].join('');

  const provider = createOpenAiProvider({ apiKey: 'sk-test', fetchImpl: async () => streamResponse(sse) });
  const events = await collect(provider.stream(request()));

  const text = events.filter((event) => event.type === 'text_delta').map((event) => (event as { delta: string }).delta).join('');
  assert.equal(text, 'Bonjour');
  const completed = events.find((event) => event.type === 'completed');
  assert.ok(completed);
  assert.equal((completed as { responseId: string }).responseId, 'resp_1');
});

test('function calls are assembled from arguments deltas', async () => {
  const sse = [
    'event: response.output_item.added\ndata: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"call_1","name":"get_grades","arguments":""}}\n\n',
    'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","item_id":"call_1","delta":"{\\"limit\\":5,"}\n\n',
    'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","item_id":"call_1","delta":"\\"period\\":null}"}\n\n',
    'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_2"}}\n\n',
  ].join('');

  const provider = createOpenAiProvider({ apiKey: 'sk-test', fetchImpl: async () => streamResponse(sse) });
  const events = await collect(provider.stream(request()));
  const call = events.find((event) => event.type === 'function_call');
  assert.ok(call);
  const typed = call as { name: string; arguments: string; callId: string };
  assert.equal(typed.name, 'get_grades');
  assert.equal(typed.callId, 'call_1');
  assert.deepEqual(JSON.parse(typed.arguments), { limit: 5, period: null });
});

test('a 401 is reported as an invalid key and the key is redacted', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'sk-secret-value',
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-secret-value' } }), { status: 401 }),
  });
  const events = await collect(provider.stream(request()));
  const error = events.find((event) => event.type === 'error') as { code: string; message: string };
  assert.equal(error.code, 'invalid_api_key');
  assert.equal(error.message.includes('sk-secret-value'), false);
  assert.match(error.message, /sk-\*\*\*/);
});

test('a missing key never performs a network call', async () => {
  let called = false;
  const provider = createOpenAiProvider({
    apiKey: '',
    fetchImpl: async () => {
      called = true;
      return streamResponse('');
    },
  });
  const events = await collect(provider.stream(request()));
  assert.equal(called, false);
  assert.equal((events[0] as { code: string }).code, 'missing_api_key');
});

test('a network failure is reported as retryable', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  const events = await collect(provider.stream(request()));
  const error = events[0] as { code: string; retryable: boolean };
  assert.equal(error.code, 'network_error');
  assert.equal(error.retryable, true);
});

test('429 maps to rate limiting', async () => {
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429 }),
  });
  const events = await collect(provider.stream(request()));
  const error = events[0] as { code: string; retryable: boolean };
  assert.equal(error.code, 'rate_limited');
  assert.equal(error.retryable, true);
});

test('function_call and function_call_output input items are serialized without loss', async () => {
  let payload: Record<string, unknown> | null = null;
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return streamResponse('event: response.completed\\ndata: {"type":"response.completed","response":{"id":"r"}}\\n\\n');
    },
  });
  const input: ProviderRequest['input'] = [
    { role: 'user', content: 'Quelle est ma moyenne ?' },
    { type: 'function_call', call_id: 'call_1', name: 'get_averages', arguments: '{}' },
    { type: 'function_call_output', call_id: 'call_1', output: '{"averages":[]}' },
  ];
  await collect(provider.stream({ ...request(), input }));
  const sent = payload?.['input'] as Record<string, unknown>[];
  assert.equal(sent[1]?.['type'], 'function_call');
  assert.equal(sent[1]?.['name'], 'get_averages');
  assert.equal(sent[2]?.['type'], 'function_call_output');
  assert.equal(sent[2]?.['output'], '{"averages":[]}');
});

test('store:false and strict tools are always sent', async () => {
  let payload: Record<string, unknown> | null = null;
  const provider = createOpenAiProvider({
    apiKey: 'sk-test',
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return streamResponse('event: response.completed\ndata: {"type":"response.completed","response":{"id":"r"}}\n\n');
    },
  });
  await collect(provider.stream(request()));
  assert.equal(payload?.['store'], false);
  assert.equal(payload?.['stream'], true);
  const tools = payload?.['tools'] as { type: string; strict: boolean }[];
  assert.equal(tools.length, TOOLS.length);
  assert.ok(tools.every((tool) => tool.type === 'function' && tool.strict === true));
});
