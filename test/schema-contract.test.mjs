import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { EXAMPLES } from '../examples.mjs';
import { validateExtraction, extractionResponseFormat, extractionShapeDiagnostic } from '../core.mjs';

const expectedFields = ['reward_type', 'reward_amount', 'reward_unit', 'listing_status', 'award_capacity',
  'awards_remaining', 'deadline', 'payout_timing', 'entry_fee', 'entry_fee_amount', 'entry_fee_unit', 'entry_requirements'];

test('strict response schema covers every validator field and nested pair', () => {
  const format = extractionResponseFormat();
  assert.equal(format.type, 'json_schema');
  assert.equal(format.json_schema.strict, true);
  const schema = format.json_schema.schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, expectedFields);
  assert.deepEqual(Object.keys(schema.properties), expectedFields);
  for (const field of expectedFields) {
    const item = schema.properties[field];
    assert.equal(item.type, 'object');
    assert.equal(item.additionalProperties, false);
    assert.deepEqual(item.required, ['value', 'quote']);
    assert.deepEqual(item.properties.quote.type, ['string', 'null']);
    assert.ok(item.properties.value.type.includes('null'));
  }
  assert.deepEqual(schema.properties.reward_amount.properties.value.type, ['number', 'null']);
  assert.deepEqual(schema.properties.awards_remaining.properties.value.type, ['integer', 'null']);
  assert.deepEqual(schema.properties.reward_type.properties.value.enum, ['cash', 'token', 'credit', 'noncash', null]);
});

test('one mocked live request forwards strict schema; local quote validation still rejects fabrication', async () => {
  const invalid = structuredClone(EXAMPLES.judged.extraction);
  invalid.reward_amount.quote = 'fabricated 999 USD cash prize';
  let calls = 0;
  const server = createApp({ apiKey: 'test-only', model: 'gpt-6-luna', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://inference-api.openserv.ai/v1/chat/completions');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'gpt-6-luna');
    assert.equal(payload.max_completion_tokens, 1100);
    assert.deepEqual(payload.response_format, extractionResponseFormat());
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(invalid) } }] }), { status: 200 });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'live', sourceText: EXAMPLES.judged.text, sourceUrl: EXAMPLES.judged.sourceUrl,
        budget: 0, horizonDays: 30, consent: true }) });
    const body = await response.json();
    assert.equal(calls, 1);
    assert.equal(response.status, 502);
    assert.equal(body.error, 'EVIDENCE_REJECTED');
    assert.equal(body.evidence_reason, 'Unsupported quote for reward_amount');
    assert.equal(body.report, undefined);
    assert.equal(body.shape_diagnostic, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('shape diagnostic exposes expected names and counts, not model supplied unknown keys', () => {
  const shape = extractionShapeDiagnostic({ reward_type: {}, attacker_secret_marker: 'do not echo' });
  assert.equal(shape.top_level_type, 'object');
  assert.equal(shape.unexpected_key_count, 1);
  assert.equal(shape.missing_expected_fields.length, 11);
  assert.ok(!JSON.stringify(shape).includes('attacker_secret_marker'));
  assert.throws(() => validateExtraction({ reward_type: {} }, EXAMPLES.judged.text),
    /Extraction fields do not match/);
});
