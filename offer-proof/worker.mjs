import { checkOffer, validateInput } from './core.mjs';

const PRICE_RAW = '10000000000000000000000000000'; // 0.01 XNO
const PREPAID_RAW = '10000000000000000000000000000000'; // 10 XNO / 1000 calls
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type,payment-signature,authorization,idempotency-key',
  'access-control-expose-headers': 'payment-required,payment-response,x-payment-id,x-prepaid-calls-remaining',
  'cache-control': 'no-store' };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors, ...extra }
});

/*
  Payment adapter contract (not implemented here):
  charge(request, { priceRaw, requestDigest }) ->
    { kind:'unpaid', paymentRequired: base64X402Requirements }
    or { kind:'paid', paymentId: canonicalConfirmedNanoBlockHash }
  It must settle/verify on nano:mainnet, verify recipient/amount, and bind an
  authenticated invoice or payer authorization to the request digest. A bare
  public block hash is not proof of that binding. It must return the SAME paid
  receipt for a retry of the SAME digest and reject reuse for another digest.
  It receives no private key from this module. The local Nano adapter is in
  nano-payment.mjs; paid routes remain undeployed and untested with real funds.

  Store contract: get(paymentId) -> {requestDigest,response} | null;
  putIfAbsent(paymentId,requestDigest,response) -> stored row. Must be atomic.
*/
export function createHandler({ payment, store, now = () => new Date(), capabilityKey = null }) {
  if (!payment?.charge || !store?.get || !store?.putIfAbsent) throw new Error('payment_and_store_required');
  return async function fetchHandler(request) {
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET' && path === '/health') return json({ status: 'ok', probe: 'GET /health' });
    if (request.method === 'GET' && path === '/docs') return json({
      service: 'Offer Proof Gate', version: '1.0',
      paid_unit: 'one bounded report on caller-supplied public listing text and 1-5 claimed evidence snippets',
      price: { network: 'nano:mainnet', asset: 'XNO', amount_raw: PRICE_RAW, amount_xno: '0.01' },
      prepaid: { endpoint: 'POST /v1/prepay', price_raw: PREPAID_RAW, calls: 1000,
        recovery: 'POST /v1/prepay/recover with the client-generated recovery secret and confirmed payment ID' },
      endpoint: 'POST /v1/offer-proof', max_body_bytes: 16384,
      input: { source_url: 'https://example.org/offer', source_text: 'Reward: 25 USDC. Status: Open. 0 awards remaining. No entry fee.',
        claims: [{ field: 'awards_remaining', value: 1, quote: '0 awards remaining' }] },
      fields: ['reward {amount,unit}', 'status open|closed', 'awards_remaining integer', 'entry_fee none|required', 'deadline ISO UTC'],
      note: 'No URL fetch or buyer/payment guarantee; exact quote checks only.'
    });
    if (request.method === 'POST' && (path === '/v1/prepay' || path === '/v1/prepay/recover')) {
      if (!capabilityKey || capabilityKey.length < 32 || !store.createPackage || !store.getPaymentIntent)
        return json({ error: 'prepay_unavailable' }, 503);
      let body;
      try {
        const bytes = await readBounded(request, 1024);
        if (!bytes) return json({ error: 'body_too_large' }, 413);
        body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!body || !/^[0-9a-fA-F]{64}$/.test(body.recovery_secret)) throw new Error('invalid');
      } catch { return json({ error: 'invalid_input' }, 400); }
      const secretHash = await sha256(body.recovery_secret.toLowerCase());
      if (path === '/v1/prepay/recover') {
        if (!/^[0-9A-F]{64}$/i.test(body.payment_id ?? '')) return json({ error: 'invalid_input' }, 400);
        try {
          const id = body.payment_id.toUpperCase();
          const intent = await store.getPaymentIntent(id);
          if (!intent || intent.purpose !== 'prepay' || intent.confirmed !== 1 ||
              intent.recovery_secret_sha256 !== secretHash) return json({ error: 'recovery_not_found' }, 404);
          const token = await capabilityToken(capabilityKey, id, body.recovery_secret.toLowerCase());
          const remaining = await store.createPackage(id, await sha256(token), secretHash);
          return json({ package_payment_id: id, capability: token, remaining_calls: remaining });
        } catch { return json({ error: 'recovery_unavailable' }, 503); }
      }
      const digest = await sha256('prepay-v1:' + secretHash);
      let charge;
      try { charge = await payment.charge(request, { priceRaw: PREPAID_RAW, requestDigest: digest,
        purpose: 'prepay', recoverySecretSha256: secretHash }); }
      catch (error) {
        if (error.message === 'payment_reserved_for_other_request') return json({ error: 'payment_reused' }, 409);
        return json({ error: 'payment_unavailable' }, 503);
      }
      if (charge?.kind === 'unpaid') return json({ error: 'payment_required', network: 'nano:mainnet',
        asset: 'XNO', amount_raw: PREPAID_RAW }, 402, { 'payment-required': charge.paymentRequired });
      if (charge?.kind === 'invalid') return json({ error: 'invalid_payment' }, 402);
      if (charge?.kind !== 'paid') return json({ error: 'payment_pending_recovery' }, 503);
      try {
        const id = charge.paymentId.toUpperCase();
        const token = await capabilityToken(capabilityKey, id, body.recovery_secret.toLowerCase());
        const remaining = await store.createPackage(id, await sha256(token), secretHash);
        return json({ package_payment_id: id, capability: token, remaining_calls: remaining }, 200,
          { 'payment-response': charge.paymentResponse });
      } catch { return json({ error: 'package_temporarily_unavailable' }, 503); }
    }
    if (request.method !== 'POST' || path !== '/v1/offer-proof') return json({ error: 'not_found' }, 404);
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > 16384) return json({ error: 'body_too_large' }, 413);
    let input;
    try {
      const bytes = await readBounded(request, 16384);
      if (!bytes) return json({ error: 'body_too_large' }, 413);
      input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      validateInput(input);
    } catch { return json({ error: 'invalid_input' }, 400); }
    // Compute before settlement: a malformed input never consumes payment.
    let result;
    try { result = await checkOffer(input, now); }
    catch { return json({ error: 'invalid_input' }, 400); }
    const requestDigest = result.source_sha256 + ':' + await sha256(JSON.stringify(input.claims));
    const bearer = request.headers.get('authorization');
    if (bearer !== null) {
      const match = bearer.match(/^Bearer ([0-9a-f]{64})$/i);
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!match || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey ?? '') || !store.usePackage)
        return json({ error: 'invalid_capability_or_key' }, 400);
      try {
        const saved = await store.usePackage(await sha256(match[1].toLowerCase()), idempotencyKey, requestDigest, result);
        return json(saved.response, 200, { 'x-prepaid-calls-remaining': String(saved.remainingCalls) });
      } catch (error) {
        if (error.message === 'credits_exhausted') return json({ error: 'credits_exhausted' }, 402);
        if (error.message === 'idempotency_key_reused') return json({ error: 'idempotency_key_reused' }, 409);
        if (error.message === 'package_not_found') return json({ error: 'capability_not_found' }, 401);
        return json({ error: 'prepay_unavailable' }, 503);
      }
    }
    let charge;
    try { charge = await payment.charge(request, { priceRaw: PRICE_RAW, requestDigest }); }
    catch (error) {
      if (error.message === 'payment_reserved_for_other_request') return json({ error: 'payment_reused' }, 409);
      return json({ error: 'payment_unavailable' }, 503);
    }
    if (charge?.kind === 'unpaid' && typeof charge.paymentRequired === 'string') {
      return json({ error: 'payment_required', network: 'nano:mainnet', asset: 'XNO', amount_raw: PRICE_RAW },
        402, { 'payment-required': charge.paymentRequired });
    }
    if (charge?.kind === 'invalid') return json({ error: 'invalid_payment' }, 402);
    if (charge?.kind === 'pending') return json({ error: 'payment_pending_recovery' }, 503);
    if (charge?.kind !== 'paid' || !/^[A-F0-9]{64}$/i.test(charge.paymentId ?? ''))
      return json({ error: 'payment_unavailable' }, 503);
    try {
      const existing = await store.get(charge.paymentId.toUpperCase());
      if (existing && existing.requestDigest !== requestDigest) return json({ error: 'payment_reused' }, 409);
      if (existing) return json(existing.response, 200, { 'x-payment-id': charge.paymentId.toUpperCase(),
        ...(charge.paymentResponse ? { 'payment-response': charge.paymentResponse } : {}) });
      // Deadline screening uses completion time, including time spent settling.
      const completedResult = await checkOffer(input, now);
      const saved = await store.putIfAbsent(charge.paymentId.toUpperCase(), requestDigest, completedResult);
      if (saved.requestDigest !== requestDigest) return json({ error: 'payment_reused' }, 409);
      return json(saved.response, 200, { 'x-payment-id': charge.paymentId.toUpperCase(),
        ...(charge.paymentResponse ? { 'payment-response': charge.paymentResponse } : {}) });
    } catch { return json({ error: 'result_temporarily_unavailable' }, 503); }
  };
}

async function sha256(s) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export { PRICE_RAW };

async function capabilityToken(keyText, paymentId, recoverySecret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode('offer-gate-prepaid-v1:' + paymentId + ':' + recoverySecret));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readBounded(request, limit) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); return null; }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
