import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../examples.mjs';
import { buildReport, validateExtraction } from '../core.mjs';

function empty() {
  return Object.fromEntries(Object.keys(EXAMPLES.judged.extraction).map(key => [key, { value: null, quote: null }]));
}

test('a dollar sign inside credit copy cannot establish a cash prize', () => {
  const source = 'Reward: $25 in API credits. Credits cannot be withdrawn or converted to cash.';
  const claim = empty();
  claim.reward_type = { value: 'cash', quote: '$25' };
  claim.reward_amount = { value: 25, quote: '$25' };
  claim.reward_unit = { value: '$', quote: '$25' };
  assert.throws(() => validateExtraction(claim, source), /affirmative cash support/);
});

test('mixed reward and fee numbers cannot be cited as reward amount', () => {
  const source = 'Reward: $50 USD cash; entry fee: $500 USD.';
  const claim = empty();
  claim.reward_type = { value: 'cash', quote: '$50 USD cash' };
  claim.reward_amount = { value: 500, quote: source };
  claim.reward_unit = { value: 'USD', quote: '$50 USD cash' };
  assert.throws(() => validateExtraction(claim, source), /Ambiguous mixed numbers/);
});

test('no refund is not free entry; negated free and cash are rejected', () => {
  let source = 'No refund of the $20 entry fee.';
  let claim = empty();
  claim.entry_fee = { value: 'none', quote: source };
  assert.throws(() => validateExtraction(claim, source), /Free entry requires/);
  source = 'Not free to enter.';
  claim = empty();
  claim.entry_fee = { value: 'none', quote: source };
  assert.throws(() => validateExtraction(claim, source), /Free entry requires/);
  source = 'No cash reward.';
  claim = empty();
  claim.reward_type = { value: 'cash', quote: source };
  assert.throws(() => validateExtraction(claim, source), /affirmative cash support/);
});

test('announced later is unknown timing, not a payout schedule', () => {
  const source = 'Payout timing will be announced later.';
  const claim = empty();
  claim.payout_timing = { value: source, quote: source };
  assert.throws(() => validateExtraction(claim, source), /Unspecified payout timing/);
});

test('fee in JPY cannot be compared directly to a USD budget', () => {
  const source = 'Entry fee: 100 JPY.';
  const claim = empty();
  claim.entry_fee = { value: 'required', quote: source };
  claim.entry_fee_amount = { value: 100, quote: source };
  claim.entry_fee_unit = { value: 'JPY', quote: source };
  const result = buildReport({ extraction: claim, sourceText: source, sourceUrl: 'https://synthetic.example/jpy',
    budget: 10, horizonDays: 30, mode: 'live_serv', model: 'gpt-6-luna' });
  assert.equal(result.budget.status, 'unknown_other_costs');
  assert.equal(result.model, 'gpt-6-luna');
});

test('explicit zero entry fee is consistent with no fee', () => {
  const source = 'Entry fee: 0 USD.';
  const claim = empty();
  claim.entry_fee = { value: 'none', quote: source };
  claim.entry_fee_amount = { value: 0, quote: source };
  claim.entry_fee_unit = { value: 'USD', quote: source };
  const result = buildReport({ extraction: claim, sourceText: source, sourceUrl: 'https://synthetic.example/no-fee',
    budget: 0, horizonDays: 30, mode: 'live_serv', model: 'gpt-6-luna' });
  assert.equal(result.budget.status, 'no_entry_fee_stated');
});

test('closed quote cannot establish open listing even with awards remaining', () => {
  const source = 'Status: Closed. Awards remaining: 1.';
  const claim = empty();
  claim.listing_status = { value: 'open', quote: 'Status: Closed' };
  claim.awards_remaining = { value: 1, quote: 'Awards remaining: 1' };
  assert.throws(() => validateExtraction(claim, source), /Listing status quote is contradictory/);
});
