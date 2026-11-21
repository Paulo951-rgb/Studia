import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_LIMITS, parseToolArguments, ToolArgumentError, type ToolName } from '@/core/ai/tools';
import { normalizeUrl } from '@/core/util/ids';

test('the 19 tools required by the specification are all declared', () => {
  const expected: ToolName[] = [
    'get_student_profile',
    'get_grades',
    'get_averages',
    'get_report_cards',
    'search_messages',
    'get_message_details',
    'search_teacher_feedback',
    'get_homework',
    'search_documents',
    'read_document',
    'get_timetable',
    'get_events',
    'get_absences',
    'get_canteen_menu',
    'get_school_news',
    'calculate_average',
    'simulate_grade',
    'get_school_summary',
    'search_school_history',
  ];
  assert.equal(TOOLS.length, 19);
  assert.deepEqual(
    TOOLS.map((tool) => tool.name).sort(),
    [...expected].sort(),
  );
});

test('every schema is compatible with OpenAI strict mode', () => {
  for (const tool of TOOLS) {
    assert.equal(tool.parameters.type, 'object', tool.name);
    assert.equal(tool.parameters.additionalProperties, false, tool.name);
    const properties = Object.keys(tool.parameters.properties);
    assert.deepEqual([...tool.parameters.required].sort(), properties.sort(), `${tool.name} must require every property`);
    assert.ok(tool.description.length > 20, `${tool.name} needs a real description`);
  }
});

test('arguments are parsed and unknown keys are rejected', () => {
  const parsed = parseToolArguments('get_grades', JSON.stringify({ period: 'Trimestre 1', subject: null, from: null, to: null, limit: 10 }));
  assert.equal(parsed.period, 'Trimestre 1');
  assert.equal(parsed.limit, 10);

  assert.throws(() => parseToolArguments('get_grades', JSON.stringify({ accountId: 'acc_other' })), ToolArgumentError);
});

test('invalid JSON, wrong types and out-of-range values are rejected', () => {
  assert.throws(() => parseToolArguments('get_grades', '{oops'), /JSON valide/);
  assert.throws(() => parseToolArguments('get_grades', JSON.stringify({ limit: 'beaucoup' })), /limit doit être un nombre/);
  assert.throws(() => parseToolArguments('get_grades', JSON.stringify({ limit: 999 })), /compris entre/);
  assert.throws(() => parseToolArguments('get_school_news', JSON.stringify({ unread_only: 'oui' })), /booléen/);
});

test('mandatory strings are enforced', () => {
  assert.throws(() => parseToolArguments('search_messages', JSON.stringify({ query: '', limit: 5 })), /query est obligatoire/);
  assert.throws(() => parseToolArguments('get_message_details', JSON.stringify({ message_id: null })), /message_id est obligatoire/);
});

test('queries are capped to avoid oversized prompts', () => {
  const long = 'a'.repeat(TOOL_LIMITS.maxQueryLength + 1);
  assert.throws(() => parseToolArguments('search_school_history', JSON.stringify({ query: long, kinds: null, limit: 5 })), /dépasse/);
});

test('search_school_history only accepts known kinds', () => {
  assert.throws(
    () => parseToolArguments('search_school_history', JSON.stringify({ query: 'oral', kinds: ['grades'], limit: 5 })),
    /valeur non autorisée/,
  );
  const ok = parseToolArguments('search_school_history', JSON.stringify({ query: 'oral', kinds: ['message', 'news'], limit: 5 }));
  assert.deepEqual(ok.kinds, ['message', 'news']);
});

test('simulate_grade requires a numeric grade within the scale', () => {
  assert.throws(
    () => parseToolArguments('simulate_grade', JSON.stringify({ subject: 'Maths', points: null, out_of: 20, coefficient: 1, period: null })),
    /points est obligatoire/,
  );
  const parsed = parseToolArguments(
    'simulate_grade',
    JSON.stringify({ subject: 'Maths', points: 14, out_of: 20, coefficient: 2, period: 'Trimestre 2' }),
  );
  assert.equal(parsed.points, 14);
  assert.equal(parsed.coefficient, 2);
});

test('school URLs must use HTTPS because credentials are sent there', () => {
  assert.equal(normalizeUrl('  college.example.fr/pronote/  '), 'https://college.example.fr/pronote');
  assert.equal(normalizeUrl('https://college.example.fr/pronote'), 'https://college.example.fr/pronote');
  assert.throws(() => normalizeUrl('http://college.example.fr/pronote'), /HTTPS requis/);
});
