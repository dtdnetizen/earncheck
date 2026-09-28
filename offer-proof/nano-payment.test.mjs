import test from 'node:test';
import assert from 'node:assert/strict';
import { createNanoPayment } from './nano-payment.mjs';

const payTo = 'nano_1q7k9k6nwdxbiewh9yetp3tsuc4ry4w9d7j7h5nb9km5bq69j7515ryxe63i';
const paymentId = 'FF0144381CFF0B2C079A115E7ADA7E96F43FD219446E7524C48D1CC9900C4F17';
const block = {
  type: 'state', account: 'nano_3qgmh14nwztqw4wmcdzy4xpqeejey68chx6nciczwn9abji7ihhum9qtpmdr',
  previous: 'F47B23107E5F34B2CE06F562B5C435DF72A533251CB414C51B2B62A8F63A00E4',
  representative: 'nano_1hza3f7wiiqa7ig3jczyxj5yo86yegcmqk3criaz838j91sxcckpfhbhhra1',
  balance: '1000000000000000000000',
  link: '19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858',
  signature: '3BFBA64A775550E6D49DF1EB8EEC2136DCD74F090E2ED658FBD9E80F17CB1C9F9F7BDE2B93D95558EC2F277FFF15FD11E6E2162A1714731B743D1E941FA4560A',
  work: 'cab7404f0b5449d0'
};
const priceRaw = '10000000000000000000000000000';
const digest = 'a'.repeat(64);
const response = body => new Response(JSON.stringify(body), { status: 200 });

function setup({ verify = true, settle = true, chain = false, verifyRedirect = 0, chainRedirect = 0 } = {}) {
  const intents = new Map(), calls = [], fetchOptions = [];
  const store = {
    getPaymentIntent: async id => intents.get(id) ?? null,
    reservePayment: async (id, requestDigest, amountRaw, purpose, recoverySecretSha256) => {
      calls.push('reserve');
      if (!intents.has(id)) intents.set(id, { request_digest: requestDigest, amount_raw: amountRaw,
        purpose, recovery_secret_sha256: recoverySecretSha256, confirmed: 0 });
      const x = intents.get(id);
      if (x.request_digest !== requestDigest || x.amount_raw !== amountRaw || x.purpose !== purpose ||
          x.recovery_secret_sha256 !== recoverySecretSha256) throw new Error('payment_reserved_for_other_request');
      return { confirmed: x.confirmed === 1, payer: x.payer };
    },
    confirmPayment: async (id, payer) => { calls.push('confirm'); Object.assign(intents.get(id), { confirmed: 1, payer }); }
  };
  const fetchImpl = async (url, opts) => {
    fetchOptions.push({ url, method: opts.method, redirect: opts.redirect });
    const redirected = status => new Response(null, { status, headers: { location: 'https://untrusted.example/redirected' } });
    if (url.endsWith('/verify') && opts.method === 'POST') { calls.push('verify'); return verifyRedirect ? redirected(verifyRedirect) : response({ isValid: verify }); }
    if (url.endsWith('/settle')) { calls.push('settle'); return response(settle ?
      { success: true, transaction: paymentId, network: 'nano:mainnet', payer: block.account } :
      { success: false, errorReason: 'confirmation_timeout', transaction: paymentId }); }
    if (url.includes('/v1/verify?')) { calls.push('chain'); return chainRedirect ? redirected(chainRedirect) : response({ ok: chain, confirmed: chain }); }
    throw new Error('unexpected_url');
  };
  const adapter = createNanoPayment({ payTo, store, fetchImpl });
  const url = 'https://seller.example/v1/offer-proof';
  const challengeRequest = new Request(url, { method: 'POST' });
  const paidRequest = accepted => new Request(url, { method: 'POST', headers: {
    'payment-signature': Buffer.from(JSON.stringify({ x402Version: 2, accepted, payload: { block } })).toString('base64') } });
  return { adapter, intents, calls, fetchOptions, challengeRequest, paidRequest };
}

test('x402 challenge, verify, reserve before settle, confirmed receipt and idempotent replay', async () => {
  const s = setup();
  const challenge = await s.adapter.charge(s.challengeRequest, { priceRaw, requestDigest: digest });
  assert.equal(challenge.kind, 'unpaid');
  const decoded = JSON.parse(Buffer.from(challenge.paymentRequired, 'base64').toString());
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts[0].payTo, payTo);
  assert.equal(decoded.accepts[0].amount, priceRaw);
  const req = s.paidRequest(decoded.accepts[0]);
  const paid = await s.adapter.charge(req, { priceRaw, requestDigest: digest });
  assert.equal(paid.kind, 'paid'); assert.equal(paid.paymentId, paymentId);
  assert.deepEqual(s.calls, ['verify', 'reserve', 'settle', 'confirm']);
  const receipt = JSON.parse(Buffer.from(paid.paymentResponse, 'base64').toString());
  assert.equal(receipt.transaction, paymentId);
  const retry = await s.adapter.charge(req, { priceRaw, requestDigest: digest });
  assert.equal(retry.kind, 'paid'); assert.equal(s.calls.filter(x => x === 'settle').length, 1);
  await assert.rejects(() => s.adapter.charge(req, { priceRaw, requestDigest: 'b'.repeat(64) }),
    /payment_reserved_for_other_request/);
});

test('an already-public block cannot establish a fresh reservation', async () => {
  const s = setup({ verify: false, chain: true });
  const challenge = await s.adapter.charge(s.challengeRequest, { priceRaw, requestDigest: digest });
  const accepted = JSON.parse(Buffer.from(challenge.paymentRequired, 'base64').toString()).accepts[0];
  const answer = await s.adapter.charge(s.paidRequest(accepted), { priceRaw, requestDigest: digest });
  assert.equal(answer.kind, 'invalid');
  assert.equal(s.intents.size, 0);
  assert.deepEqual(s.calls, ['verify']);
});

test('ambiguous settlement only recovers a preverified, reserved confirmed block', async () => {
  const s = setup({ settle: false, chain: true });
  const challenge = await s.adapter.charge(s.challengeRequest, { priceRaw, requestDigest: digest });
  const accepted = JSON.parse(Buffer.from(challenge.paymentRequired, 'base64').toString()).accepts[0];
  const answer = await s.adapter.charge(s.paidRequest(accepted), { priceRaw, requestDigest: digest });
  assert.equal(answer.kind, 'paid');
  assert.deepEqual(s.calls, ['verify', 'reserve', 'settle', 'chain', 'confirm']);
});

test('facilitator verify 302 is never followed or reserved', async () => {
  const s = setup({ verifyRedirect: 302 });
  const challenge = await s.adapter.charge(s.challengeRequest, { priceRaw, requestDigest: digest });
  const accepted = JSON.parse(Buffer.from(challenge.paymentRequired, 'base64').toString()).accepts[0];
  const answer = await s.adapter.charge(s.paidRequest(accepted), { priceRaw, requestDigest: digest });
  assert.equal(answer.kind, 'pending');
  assert.equal(s.intents.size, 0);
  assert.deepEqual(s.calls, ['verify']);
  assert.deepEqual(s.fetchOptions.map(x => x.redirect), ['manual']);
  assert.deepEqual(s.fetchOptions.map(x => x.url), ['https://facilitator.pursekeeper.dev/verify']);
});

test('ledger read 307 is never followed or treated as confirmed', async () => {
  const s = setup({ settle: false, chainRedirect: 307 });
  const challenge = await s.adapter.charge(s.challengeRequest, { priceRaw, requestDigest: digest });
  const accepted = JSON.parse(Buffer.from(challenge.paymentRequired, 'base64').toString()).accepts[0];
  const answer = await s.adapter.charge(s.paidRequest(accepted), { priceRaw, requestDigest: digest });
  assert.equal(answer.kind, 'pending');
  assert.deepEqual(s.calls, ['verify', 'reserve', 'settle', 'chain']);
  assert.ok(s.fetchOptions.every(x => x.redirect === 'manual'));
  assert.equal(s.fetchOptions.length, 3);
});
