import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './worker.mjs';

const id = 'A'.repeat(64);
const secret = 'b'.repeat(64);
const listing = { source_url: 'https://bounty.example/42',
  source_text: 'Reward: 25 USDC. Status: Open. 0 awards remaining.',
  claims: [{ field: 'awards_remaining', value: 1, quote: '0 awards remaining' }] };

test('prepay capability, secret recovery, idempotent debit, changed-body rejection', async () => {
  let intent, pkg, uses = 0;
  const reports = new Map();
  const store = {
    getPaymentIntent: async paymentId => paymentId === id ? intent : null,
    createPackage: async (paymentId, tokenHash, secretHash) => {
      assert.equal(paymentId, id);
      assert.equal(intent.recovery_secret_sha256, secretHash);
      if (!pkg) pkg = { tokenHash, remaining: 1000 };
      assert.equal(pkg.tokenHash, tokenHash);
      return pkg.remaining;
    },
    usePackage: async (tokenHash, key, digest, response) => {
      if (tokenHash !== pkg?.tokenHash) throw new Error('package_not_found');
      if (reports.has(key)) {
        const saved = reports.get(key);
        if (saved.digest !== digest) throw new Error('idempotency_key_reused');
        return { response: saved.response, remainingCalls: pkg.remaining };
      }
      pkg.remaining--; uses++;
      reports.set(key, { digest, response });
      return { response, remainingCalls: pkg.remaining };
    },
    get: async () => null, putIfAbsent: async () => null
  };
  const payment = { charge: async (request, opts) => {
    if (!request.headers.has('payment-signature')) return { kind: 'unpaid', paymentRequired: 'mock-x402' };
    intent = { purpose: 'prepay', confirmed: 1, recovery_secret_sha256: opts.recoverySecretSha256 };
    return { kind: 'paid', paymentId: id, paymentResponse: 'mock-settlement' };
  } };
  const handler = createHandler({ payment, store, capabilityKey: 'test-server-secret-xxxxxxxxxxxxxxxxxxxxxxxx' });
  const prepayUrl = 'https://seller.example/v1/prepay';
  const payload = JSON.stringify({ recovery_secret: secret });
  const unpaid = await handler(new Request(prepayUrl, { method: 'POST', body: payload }));
  assert.equal(unpaid.status, 402);
  const paid = await handler(new Request(prepayUrl, { method: 'POST', body: payload,
    headers: { 'payment-signature': 'mock' } }));
  assert.equal(paid.status, 200);
  assert.equal(paid.headers.get('payment-response'), 'mock-settlement');
  const pack = await paid.json();
  assert.equal(pack.remaining_calls, 1000);
  assert.match(pack.capability, /^[0-9a-f]{64}$/);
  const recovered = await handler(new Request('https://seller.example/v1/prepay/recover', {
    method: 'POST', body: JSON.stringify({ payment_id: id, recovery_secret: secret }) }));
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).capability, pack.capability);
  const headers = { authorization: 'Bearer ' + pack.capability, 'idempotency-key': 'first-call-0000001' };
  const callUrl = 'https://seller.example/v1/offer-proof';
  const first = await handler(new Request(callUrl, { method: 'POST', body: JSON.stringify(listing), headers }));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-prepaid-calls-remaining'), '999');
  const retry = await handler(new Request(callUrl, { method: 'POST', body: JSON.stringify(listing), headers }));
  assert.equal(retry.status, 200); assert.equal(uses, 1);
  const changed = structuredClone(listing); changed.claims[0].value = 0;
  const mismatch = await handler(new Request(callUrl, { method: 'POST', body: JSON.stringify(changed), headers }));
  assert.equal(mismatch.status, 409); assert.equal(uses, 1);
  const badRecovery = await handler(new Request('https://seller.example/v1/prepay/recover', {
    method: 'POST', body: JSON.stringify({ payment_id: id, recovery_secret: 'c'.repeat(64) }) }));
  assert.equal(badRecovery.status, 404);
});
