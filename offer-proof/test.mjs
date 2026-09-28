import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOffer } from './core.mjs';
import { createHandler, PRICE_RAW } from './worker.mjs';

const sourceText = 'Reward: 25 USDC. Status: Open. 0 awards remaining. No entry fee.';
const sourceUrl = 'https://example.org/public-bounty';
const claims = [
  { field: 'reward', value: { amount: 25, unit: 'USDC' }, quote: 'Reward: 25 USDC' },
  { field: 'status', value: 'open', quote: 'Status: Open' },
  { field: 'awards_remaining', value: 0, quote: '0 awards remaining' },
  { field: 'entry_fee', value: 'none', quote: 'No entry fee' }
];
const input = () => ({ source_url: sourceUrl, source_text: sourceText, claims: structuredClone(claims) });
const fixedNow = () => new Date('2026-09-27T16:00:00.000Z');

test('open label plus zero remaining yields no advertised award availability', async () => {
  const out = await checkOffer(input(), fixedNow);
  assert.equal(out.verdict, 'quote_matches');
  assert.equal(out.availability_from_selected_quotes, 'no_awards_indicated_by_selected_quotes');
  assert.equal(out.source_url_status, 'caller_supplied_not_fetched');
  assert.match(out.source_sha256, /^[0-9a-f]{64}$/);
});

test('claim of one remaining contradicts its exact zero-remaining quote', async () => {
  const x = input(); x.claims[2].value = 1;
  const out = await checkOffer(x, fixedNow);
  assert.equal(out.verdict, 'quote_conflicts');
  assert.equal(out.checks[2].observed, 0);
  assert.equal(out.availability_from_selected_quotes, 'no_awards_indicated_by_selected_quotes');
});

test('elapsed quoted deadline overrides a still-open badge with positive capacity', async () => {
  const x = input();
  x.source_text = 'Status: Open. 2 awards remaining. Deadline: 2026-09-27T15:00:00Z.';
  x.claims = [
    { field: 'status', value: 'open', quote: 'Status: Open' },
    { field: 'awards_remaining', value: 2, quote: '2 awards remaining' },
    { field: 'deadline', value: '2026-09-27T15:00:00Z', quote: 'Deadline: 2026-09-27T15:00:00Z' }
  ];
  const out = await checkOffer(x, fixedNow);
  assert.equal(out.verdict, 'quote_matches');
  assert.equal(out.availability_from_selected_quotes, 'selected_deadline_elapsed');
});

test('open and positive capacity alone never certify availability', async () => {
  const x = input();
  x.source_text = 'Status: Open. 2 awards remaining. Deadline: 2026-09-01T00:00:00Z.';
  x.claims = [
    { field: 'status', value: 'open', quote: 'Status: Open' },
    { field: 'awards_remaining', value: 2, quote: '2 awards remaining' }
  ];
  const out = await checkOffer(x, fixedNow);
  assert.equal(out.availability_from_selected_quotes, 'unknown');
});

test('missing or ambiguous evidence stays uncheckable, never passes', async () => {
  const x = input(); x.claims[0].quote = 'Reward: 250 USDC';
  assert.equal((await checkOffer(x, fixedNow)).checks[0].verdict, 'uncheckable');
  x.claims[0].quote = 'Reward: 25 USDC and 50 credits';
  x.source_text += ' Reward: 25 USDC and 50 credits';
  assert.equal((await checkOffer(x, fixedNow)).checks[0].verdict, 'uncheckable');
});

test('fee quote cannot masquerade as a reward', async () => {
  const x = input(); x.source_text += ' Entry fee: 25 USDC';
  x.claims = [{ field: 'reward', value: { amount: 25, unit: 'USDC' }, quote: 'Entry fee: 25 USDC' }];
  assert.equal((await checkOffer(x, fixedNow)).verdict, 'uncheckable');
});

test('negated reward and sold-out open wording cannot yield supported availability', async () => {
  const x = input();
  x.source_text = 'Reward: not 25 USDC. Status: Open but sold out.';
  x.claims = [
    { field: 'reward', value: { amount: 25, unit: 'USDC' }, quote: 'Reward: not 25 USDC' },
    { field: 'status', value: 'open', quote: 'Status: Open but sold out' }
  ];
  const out = await checkOffer(x, fixedNow);
  assert.equal(out.verdict, 'uncheckable');
  assert.equal(out.availability_from_selected_quotes, 'unknown');
  assert.deepEqual(out.checks.map(x => x.verdict), ['uncheckable', 'uncheckable']);
});

test('a later labeled correction stops a quote-local status from passing', async () => {
  const x = input();
  x.source_text = 'Status: Open. Correction: Status: Closed. 0 awards remaining.';
  x.claims = [{ field: 'status', value: 'open', quote: 'Status: Open' }];
  const out = await checkOffer(x, fixedNow);
  assert.equal(out.verdict, 'uncheckable');
  assert.equal(out.checks[0].reason, 'conflicting_labeled_values_in_supplied_text');
  assert.equal(out.availability_from_selected_quotes, 'unknown');
});

test('a positive fractional entry fee is recognized; impossible dates are rejected', async () => {
  const x = input(); x.source_text = 'Entry fee: $0.50.';
  x.claims = [{ field: 'entry_fee', value: 'required', quote: 'Entry fee: $0.50' }];
  assert.equal((await checkOffer(x, fixedNow)).verdict, 'quote_matches');
  x.claims = [{ field: 'deadline', value: '2026-02-30T00:00:00Z', quote: '2026-02-30T00:00:00Z' }];
  await assert.rejects(() => checkOffer(x, fixedNow), /invalid_deadline/);
});

test('payment gate charges only validated work, records one body per block and replays result', async () => {
  const rows = new Map(); let charged = 0;
  const block = 'A'.repeat(64);
  const store = { get: async id => rows.get(id) ?? null,
    putIfAbsent: async (id, requestDigest, response) => {
      if (!rows.has(id)) rows.set(id, { requestDigest, response });
      return rows.get(id);
    } };
  const payment = { charge: async (req, opts) => {
    charged++; assert.equal(opts.priceRaw, PRICE_RAW);
    return req.headers.has('payment-signature') ? { kind: 'paid', paymentId: block } :
      { kind: 'unpaid', paymentRequired: 'base64-test-requirements' };
  } };
  const handler = createHandler({ payment, store, now: fixedNow });
  const url = 'https://seller.example/v1/offer-proof';
  const bad = await handler(new Request(url, { method: 'POST', body: '{broken' }));
  assert.equal(bad.status, 400); assert.equal(charged, 0);
  const unpaid = await handler(new Request(url, { method: 'POST', body: JSON.stringify(input()) }));
  assert.equal(unpaid.status, 402); assert.equal(unpaid.headers.get('payment-required'), 'base64-test-requirements');
  assert.equal(charged, 1);
  const headers = { 'payment-signature': 'mock-confirmed-block' };
  const paid = await handler(new Request(url, { method: 'POST', headers, body: JSON.stringify(input()) }));
  assert.equal(paid.status, 200); assert.equal((await paid.json()).verdict, 'quote_matches');
  const retry = await handler(new Request(url, { method: 'POST', headers, body: JSON.stringify(input()) }));
  assert.equal(retry.status, 200); assert.equal(rows.size, 1);
  const changed = input(); changed.claims[2].value = 1;
  const reused = await handler(new Request(url, { method: 'POST', headers, body: JSON.stringify(changed) }));
  assert.equal(reused.status, 409); assert.deepEqual(await reused.json(), { error: 'payment_reused' });
  const changedUrl = input(); changedUrl.source_url = 'https://example.org/other-public-bounty';
  const urlReused = await handler(new Request(url, { method: 'POST', headers, body: JSON.stringify(changedUrl) }));
  assert.equal(urlReused.status, 409);
});

test('deadline is evaluated at report completion after settlement', async () => {
  let current = new Date('2026-09-27T15:59:59Z');
  const rows = new Map(), id = 'B'.repeat(64);
  const store = { get: async key => rows.get(key) ?? null,
    putIfAbsent: async (key, requestDigest, response) => {
      rows.set(key, { requestDigest, response }); return rows.get(key);
    } };
  const payment = { charge: async () => {
    current = new Date('2026-09-27T16:00:01Z');
    return { kind: 'paid', paymentId: id };
  } };
  const handler = createHandler({ payment, store, now: () => current });
  const x = input();
  x.source_text = 'Status: Open. 2 awards remaining. Deadline: 2026-09-27T16:00:00Z.';
  x.claims = [
    { field: 'status', value: 'open', quote: 'Status: Open' },
    { field: 'awards_remaining', value: 2, quote: '2 awards remaining' },
    { field: 'deadline', value: '2026-09-27T16:00:00Z', quote: 'Deadline: 2026-09-27T16:00:00Z' }
  ];
  const response = await handler(new Request('https://seller.example/v1/offer-proof', {
    method: 'POST', body: JSON.stringify(x) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).availability_from_selected_quotes, 'selected_deadline_elapsed');
});

test('oversized body is rejected before payment and probe routes are free', async () => {
  let charged = 0;
  const handler = createHandler({ payment: { charge: async () => { charged++; return null; } },
    store: { get: async () => null, putIfAbsent: async () => null } });
  assert.equal((await handler(new Request('https://seller.example/health'))).status, 200);
  const docs = await handler(new Request('https://seller.example/docs'));
  assert.equal(docs.status, 200);
  assert.equal((await docs.json()).payment.max_timeout_seconds, 60);
  const huge = await handler(new Request('https://seller.example/v1/offer-proof', {
    method: 'POST', body: 'x'.repeat(16385) }));
  assert.equal(huge.status, 413); assert.equal(charged, 0);
});
