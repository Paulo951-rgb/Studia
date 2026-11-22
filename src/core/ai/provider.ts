import type { ToolDefinition, ToolName } from '@/core/ai/tools';
import { parseToolArguments, ToolArgumentError } from '@/core/ai/tools';
import type { ToolRunner } from '@/core/ai/toolRunner';

export type ProviderInputItem =
  | { role: 'user' | 'assistant'; content: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string };

export type ProviderRequest = {
  model: string;
  instructions: string;
  input: ProviderInputItem[];
  tools: ToolDefinition[];
  /** Requests that OpenAI does not retain the response (`store: false`). */
  store: false;
  maxOutputTokens?: number;
};

export type ProviderEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'function_call'; callId: string; name: string; arguments: string }
  | { type: 'completed'; responseId: string | null; usage?: { inputTokens: number | null; outputTokens: number | null } }
  | { type: 'error'; code: AiErrorCode; message: string; retryable: boolean };

export type AiErrorCode =
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'network_error'
  | 'server_error'
  | 'bad_request'
  | 'cancelled'
  | 'timeout'
  | 'tool_round_limit'
  | 'stream_interrupted'
  | 'consent_required'
  | 'memory_disabled'
  | 'unknown';

export interface AiProvider {
  readonly id: string;
  stream(request: ProviderRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent>;
}

export type AgentTurnResult = {
  text: string;
  toolCalls: { name: string; arguments: string; ok: boolean; errorCode?: string }[];
  responseId: string | null;
  errorCode: AiErrorCode | null;
  /** Sum of the provider usage across the tool rounds, when the API returns it. */
  usage?: { inputTokens: number | null; outputTokens: number | null };
};

export type AgentTurnOptions = {
  provider: AiProvider;
  runner: ToolRunner;
  model: string;
  instructions: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
  tools: ToolDefinition[];
  maxToolRounds?: number;
  signal?: AbortSignal;
  onTextDelta?: (delta: string) => void;
  onToolStart?: (call: { name: string; arguments: string }) => void;
  onToolEnd?: (call: { name: string; ok: boolean; errorCode?: string }) => void;
};

/**
 * One user turn, including the tool-calling loop.
 *
 * The model may ask for tools; the app executes them locally and sends back only
 * their results. The loop is bounded so a misbehaving model cannot spin forever.
 */
export async function runAgentTurn(options: AgentTurnOptions): Promise<AgentTurnResult> {
  const {
    provider,
    runner,
    model,
    instructions,
    history,
    userMessage,
    tools,
    maxToolRounds = 4,
    signal,
    onTextDelta,
    onToolStart,
    onToolEnd,
  } = options;

  const input: ProviderInputItem[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content }) as ProviderInputItem),
    { role: 'user', content: userMessage },
  ];

  let text = '';
  let responseId: string | null = null;
  const executed: AgentTurnResult['toolCalls'] = [];
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  const totalUsage = () => ({ inputTokens, outputTokens });

  for (let round = 0; round < maxToolRounds; round += 1) {
    const pendingCalls: { callId: string; name: string; arguments: string }[] = [];
    let roundError: { code: AiErrorCode; message: string } | null = null;

    for await (const event of provider.stream({ model, instructions, input, tools, store: false }, signal)) {
      if (event.type === 'text_delta') {
        text += event.delta;
        onTextDelta?.(event.delta);
      } else if (event.type === 'function_call') {
        pendingCalls.push({ callId: event.callId, name: event.name, arguments: event.arguments });
      } else if (event.type === 'completed') {
        responseId = event.responseId;
        if (event.usage) {
          if (typeof event.usage.inputTokens === 'number') {
            inputTokens = (inputTokens ?? 0) + event.usage.inputTokens;
          }
          if (typeof event.usage.outputTokens === 'number') {
            outputTokens = (outputTokens ?? 0) + event.usage.outputTokens;
          }
        }
      } else if (event.type === 'error') {
        roundError = { code: event.code, message: event.message };
      }
    }

    if (roundError) {
      return { text, toolCalls: executed, responseId, errorCode: roundError.code, usage: totalUsage() };
    }
    if (pendingCalls.length === 0) {
      return { text, toolCalls: executed, responseId, errorCode: null, usage: totalUsage() };
    }

    // With store:false, replay assistant function_call items alongside their outputs.
    input.push(...pendingCalls.map((call) => ({ type: 'function_call' as const, call_id: call.callId, name: call.name, arguments: call.arguments })));
    const knownNames = new Set(tools.map((tool) => tool.name));
    for (const call of pendingCalls) {
      onToolStart?.({ name: call.name, arguments: call.arguments });

      if (!knownNames.has(call.name as ToolName)) {
        const output = JSON.stringify({ error: 'tool_not_allowed', name: call.name });
        executed.push({ name: call.name, arguments: call.arguments, ok: false, errorCode: 'tool_not_allowed' });
        onToolEnd?.({ name: call.name, ok: false, errorCode: 'tool_not_allowed' });
        input.push({ type: 'function_call_output', call_id: call.callId, output });
        continue;
      }

      try {
        const args = parseToolArguments(call.name as ToolName, call.arguments);
        const result = await runner.run(call.name as ToolName, args);
        const output = result.ok
          ? result.data
          : JSON.stringify({ error: result.error.code, message: result.error.message });
        executed.push({
          name: call.name,
          arguments: call.arguments,
          ok: result.ok,
          ...(result.ok ? {} : { errorCode: result.error.code }),
        });
        onToolEnd?.({ name: call.name, ok: result.ok, ...(result.ok ? {} : { errorCode: result.error.code }) });
        input.push({ type: 'function_call_output', call_id: call.callId, output });
      } catch (error) {
        const code = error instanceof ToolArgumentError ? error.code : 'tool_execution_failed';
        executed.push({ name: call.name, arguments: call.arguments, ok: false, errorCode: code });
        onToolEnd?.({ name: call.name, ok: false, errorCode: code });
        input.push({
          type: 'function_call_output',
          call_id: call.callId,
          output: JSON.stringify({ error: code, message: error instanceof Error ? error.message : 'Erreur' }),
        });
      }
    }
  }

  // The round limit was reached with calls still pending: say so instead of returning
  // an empty answer that looks like a silent failure.
  return { text, toolCalls: executed, responseId, errorCode: 'tool_round_limit', usage: totalUsage() };
}
