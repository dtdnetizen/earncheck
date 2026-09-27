import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXAMPLES } from '../examples.mjs';
import { buildReport, validateExtraction } from '../core.mjs';
import { textElement } from '../dom.mjs';

const report = (example, extraction = example.extraction) => buildReport({
  extraction, sourceText: example.text, sourceUrl: example.sourceUrl,
  budget: 0, horizonDays: 30, mode: 'synthetic_example', model: null
});

test('a fabricated citation is rejected, including a fabricated numeric claim', () => {
  const fake = structuredClone(EXAMPLES.judged.extraction);
  fake.reward_amount = { value: 500, quote: '$500 USD cash prize' };
  assert.throws(() => validateExtraction(fake, EXAMPLES.judged.text), /Unsupported quote/);
  const changedNumber = structuredClone(EXAMPLES.judged.extraction);
  changedNumber.reward_amount.value = 500;
  assert.throws(() => validateExtraction(changedNumber, EXAMPLES.judged.text), /Number absent/);
});

test('credit remains noncash even when denominated in dollars', () => {
  const result = report(EXAMPLES.credit);
  assert.equal(result.advertised_reward.type, 'credit_not_cash');
  assert.equal(result.advertised_reward.amount, 25);
  const invalid = structuredClone(EXAMPLES.credit.extraction);
  invalid.reward_type.value = 'cash';
  assert.throws(() => validateExtraction(invalid, EXAMPLES.credit.text), /Cash type lacks affirmative cash support/);
});

test('zero remaining awards overrides an open badge', () => {
  const result = report(EXAMPLES.exhausted);
  assert.equal(result.award_availability.listing_status, 'open');
  assert.equal(result.award_availability.status, 'no_awards_indicated');
});

test('payout timing stays unknown when the text says it will be announced later', () => {
  const result = report(EXAMPLES.judged);
  assert.equal(result.payout_timing.status, 'unknown');
  assert.equal(result.payout_timing.horizon_fit, 'not_verified');
  assert.ok(result.next_questions.some(x => x.includes('actually be paid')));
});

test('unsupported fields and malformed unknowns are rejected', () => {
  const extra = structuredClone(EXAMPLES.judged.extraction);
  extra.predicted_income = { value: 100, quote: '$150' };
  assert.throws(() => validateExtraction(extra, EXAMPLES.judged.text), /allowed schema/);
  const unknown = structuredClone(EXAMPLES.judged.extraction);
  unknown.payout_timing.quote = 'Payout timing will be announced later';
  assert.throws(() => validateExtraction(unknown, EXAMPLES.judged.text), /must have no quote/);
});

test('model HTML is passed to textContent, never parsed as markup', async () => {
  const html = '<img src=x onerror=alert(1)>';
  const writes = [];
  const fakeDoc = { createElement(tag) { return {
    tag,
    set textContent(value) { writes.push(['textContent', value]); },
    set innerHTML(_) { throw new Error('HTML parser called'); }
  }; } };
  const card = textElement(fakeDoc, 'blockquote', 'evidence-card', html);
  assert.equal(card.tag, 'blockquote');
  assert.deepEqual(writes, [['textContent', html]]);
  const uiSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(uiSource, /\.innerHTML|insertAdjacentHTML|document\.write/);
});
