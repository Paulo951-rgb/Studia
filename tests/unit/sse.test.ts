import test from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser } from '@/core/ai/sse';

test('a complete SSE message is parsed with its event name', () => {
  const parse = createSseParser();
  const messages = parse('event: response.output_text.delta\ndata: {"delta":"Bon"}\n\n');
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.event, 'response.output_text.delta');
  assert.deepEqual(JSON.parse(messages[0]?.data ?? '{}'), { delta: 'Bon' });
});

test('messages split across chunks are buffered until the blank line', () => {
  const parse = createSseParser();
  assert.deepEqual(parse('event: x\ndata: {"a":'), []);
  assert.deepEqual(parse('1}\n'), []);
  const messages = parse('\n');
  assert.equal(messages.length, 1);
  assert.deepEqual(JSON.parse(messages[0]?.data ?? '{}'), { a: 1 });
});

test('multiple messages in one chunk are all emitted in order', () => {
  const parse = createSseParser();
  const messages = parse('data: one\n\ndata: two\n\n');
  assert.deepEqual(
    messages.map((message) => message.data),
    ['one', 'two'],
  );
});

test('CRLF line endings and comment lines are handled', () => {
  const parse = createSseParser();
  const messages = parse(': keep-alive\r\nevent: ping\r\ndata: {"ok":true}\r\n\r\n');
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.event, 'ping');
});

test('multi-line data fields are joined with a newline', () => {
  const parse = createSseParser();
  const messages = parse('data: line1\ndata: line2\n\n');
  assert.equal(messages[0]?.data, 'line1\nline2');
});

test('incomplete trailing data is not emitted', () => {
  const parse = createSseParser();
  assert.equal(parse('data: unfinished').length, 0);
});
