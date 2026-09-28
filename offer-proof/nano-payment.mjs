// x402 v2 exact/Nano adapter. No private wallet key: signed payer blocks are
// verified and broadcast by the fixed facilitator, then reconciled by hash.
import { nanoStateHash } from './nano-hash.mjs';

const FACILITATOR = 'https://facilitator.pursekeeper.dev';
const LEDGER = 'https://pursekeeper.dev';
export const EXPECTED_PAY_TO = 'nano_1q7k9k6nwdxbiewh9yetp3tsuc4ry4w9d7j7h5nb9km5bq69j7515ryxe63i';
const hashPattern = /^[0-9A-F]{64}$/i;
const rawPattern = /^[1-9]\d*$/;

function base64Json(object) {
  const bytes = new TextEncoder().encode(JSON.stringify(object));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decodeHeader(value) {
  if (typeof value !== 'string' || value.length > 16000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('invalid_payment_header');
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function requirements(payTo, amount) {
  return { scheme: 'exact', network: 'nano:mainnet', asset: 'XNO', payTo,
    amount, maxTimeoutSeconds: 60, extra: { paymentFlow: 'upfront', work: 'required' } };
}
function sameRequirements(actual, expected) {
  return actual?.scheme === expected.scheme && actual?.network === expected.network &&
    actual?.asset === expected.asset && actual?.payTo === expected.payTo &&
    actual?.amount === expected.amount;
}
async function readJson(response) {
  if (!response.ok) throw new Error('upstream_unavailable');
  const text = await response.text();
  if (text.length > 32000) throw new Error('upstream_unavailable');
  return JSON.parse(text);
}

export function createNanoPayment({ payTo, store, fetchImpl = fetch }) {
  if (payTo !== EXPECTED_PAY_TO ||
      !store?.reservePayment || !store?.confirmPayment || !store?.getPaymentIntent) throw new Error('payment_config_invalid');
  async function post(path, body, timeoutMs) {
    const response = await fetchImpl(FACILITATOR + path, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return readJson(response);
  }
  async function confirmedOnChain(paymentId, amountRaw) {
    const url = new URL('/v1/verify', LEDGER);
    url.search = new URLSearchParams({ hash: paymentId, to: payTo, min_raw: amountRaw }).toString();
    const result = await readJson(await fetchImpl(url.toString(), { method: 'GET',
      signal: AbortSignal.timeout(8000), redirect: 'manual' }));
    return result.ok === true && result.confirmed === true;
  }
  return {
    async charge(request, { priceRaw, requestDigest, purpose = 'report', recoverySecretSha256 = null }) {
      if (!rawPattern.test(priceRaw) ||
          !(/^[0-9a-f]{64}:[0-9a-f]{64}$/i.test(requestDigest) || /^[0-9a-f]{64}$/i.test(requestDigest)) ||
          !['report','prepay'].includes(purpose))
        throw new Error('payment_config_invalid');
      const req = requirements(payTo, priceRaw);
      const header = request.headers.get('payment-signature');
      if (!header) {
        return { kind: 'unpaid', paymentRequired: base64Json({ x402Version: 2,
          error: 'PAYMENT-SIGNATURE header is required', resource: { url: request.url,
            description: purpose === 'prepay' ? '1000 prepaid Offer Proof Gate reports' : 'One Offer Proof Gate report',
            mimeType: 'application/json' }, accepts: [req], extensions: {} }) };
      }
      let payload, paymentId;
      try {
        payload = decodeHeader(header);
        if (payload?.x402Version !== 2 || !sameRequirements(payload.accepted, req)) throw new Error('invalid_payment');
        paymentId = nanoStateHash(payload.payload?.block);
        if (!hashPattern.test(paymentId)) throw new Error('invalid_payment');
      } catch { return { kind: 'invalid' }; }
      const envelope = { x402Version: 2, paymentPayload: payload, paymentRequirements: req };
      const prior = await store.getPaymentIntent(paymentId);
      if (!prior) {
        // An already-public block is never allowed to reserve new work. Verify
        // the signed unspent send FIRST, then atomically reserve before broadcast.
        let check;
        try { check = await post('/verify', envelope, 12000); }
        catch { return { kind: 'pending' }; }
        if (check.isValid !== true) return { kind: 'invalid' };
      }
      // A signed send has no memo. This durable first-writer reservation is the
      // binding to one request/purpose before any /settle call.
      const reservation = await store.reservePayment(paymentId, requestDigest, priceRaw, purpose, recoverySecretSha256);
      if (reservation.confirmed) return { kind: 'paid', paymentId,
        paymentResponse: base64Json({ success: true, transaction: paymentId,
          network: 'nano:mainnet', payer: reservation.payer ?? payload.payload.block.account }) };
      let verified = !prior;
      if (prior) {
        try { verified = (await post('/verify', envelope, 12000)).isValid === true; }
        catch { verified = false; }
      }
      if (verified) {
        try {
          const settled = await post('/settle', envelope, 20000);
          if (settled.success === true && String(settled.transaction).toUpperCase() === paymentId) {
            await store.confirmPayment(paymentId, settled.payer ?? payload.payload.block.account);
            return { kind: 'paid', paymentId,
              paymentResponse: base64Json({ success: true, transaction: paymentId,
                network: 'nano:mainnet', payer: settled.payer ?? payload.payload.block.account }) };
          }
        } catch { /* Check the immutable block hash before retrying. */ }
      }
      try {
        // Initial /verify checked exact delta and link before this intent was
        // created. Only that signed, reserved block may be recovered.
        if (await confirmedOnChain(paymentId, priceRaw)) {
          await store.confirmPayment(paymentId, payload.payload.block.account);
          return { kind: 'paid', paymentId,
            paymentResponse: base64Json({ success: true, transaction: paymentId,
              network: 'nano:mainnet', payer: payload.payload.block.account }) };
        }
      } catch { /* A network failure must never be interpreted as paid. */ }
      return { kind: 'pending' };
    }
  };
}
