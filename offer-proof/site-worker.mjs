import html from './index.html';
import sample from './sample-input.json';
import { checkOffer } from './core.mjs';
import { createRuntime } from './runtime.mjs';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname;
    const enabled=env?.PAYMENTS_ENABLED==='true';
    if(path==='/health' || path.startsWith('/v1/')) return createRuntime(env).fetch(request);
    if(request.method==='GET' && path==='/') {
      const page=enabled ? html.replace('Preview · payments disabled','Paid API · Nano mainnet').replace('Paid access is disabled in this preview. No payment is requested.','POST a valid input to receive an HTTP 402 quote with the exact Nano address and amount. Pay only after reviewing that quote and retry with the signed payment. Payment and result retries are bound to the original input. This API does not prove that an offer is live or funded.') : html;
      return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
    }
    if(request.method==='GET' && path==='/demo') return json(await checkOffer(sample));
    if(request.method==='GET' && path==='/docs' && enabled) return createRuntime(env).fetch(request);
    if(request.method==='GET' && path==='/docs') return json({service:'Copperglass Offer Proof',version:'preview',payments_enabled:false,endpoint:'POST /v1/offer-proof',proposed_price:{network:'nano:mainnet',amount_xno:'0.01'},max_request_bytes:16384,sample,verdicts:['quote_matches','quote_conflicts','uncheckable'],scope:'Narrow labeled English quotes in caller-supplied public text. No page fetch, current-offer verification, solvency or payout guarantee. Preview does not accept payments.'});
    if(request.method==='GET' && path==='/sample-input.json') return json(sample);
    if(request.method==='GET' && path==='/llms.txt') return new Response(`# Copperglass Offer Proof\n\nPayment mode: ${enabled?'enabled':'disabled preview'}.\n\nA deterministic extraction check on caller-supplied PUBLIC offer text and exact quotes. No source fetching, solvency check, live eligibility verification or payment guarantee. Read GET /docs for the accepted narrow grammar and POST /v1/offer-proof for one report. GET /sample-input.json is a synthetic request; GET /demo executes that fixed example for free.\n\nPrice: 0.01 XNO on nano:mainnet. A valid unpaid POST quotes the fixed receiving address and raw amount in PAYMENT-REQUIRED (x402 v2 exact). The payer supplies a signed Nano send in PAYMENT-SIGNATURE; the fixed facilitator verifies and settles it. Only use funds when your operator authorizes the purchase. No self-test purchase or subsidy eligibility is implied.\n\nRecovery: retry the SAME signed block and body after an interrupted settlement. Do not create a second payment just because a response timed out. The same successful payment/body returns the stored report. Changing the body returns 409. A public send hash alone is not an accepted payment credential.\n\nPrepay: POST /v1/prepay with {"recovery_secret":"64 cryptographically random hex characters"} quotes 10 XNO for 1,000 calls. On confirmed settlement keep the returned capability private. Use Authorization: Bearer and a fresh Idempotency-Key of 16-128 letters, digits, underscores or hyphens for each new report. Reuse that key only to retry the identical input. POST /v1/prepay/recover accepts payment_id and the original recovery_secret after local settlement confirmation. A pending purchase must first retry its signed block/body until confirmed.\n\nReports and payment records persist for retry recovery; send no secrets, customer messages or personal data. Nano is the only payment rail. Contact copperglassqa@atomicmail.ai for delivery problems.\n`,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
    if(request.method==='POST') return json({error:'preview_payments_disabled',message:'No payment is requested or accepted in this preview.'},503);
    return json({error:'not_found'},404);
  }
};
