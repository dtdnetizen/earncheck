import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, validateSourceUrl } from '../server.mjs';
import { EXAMPLES } from '../examples.mjs';

async function withServer(options, fn) {
  const server = createApp(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(origin); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const post = (base, body, headers = {}) => fetch(`${base}/api/analyze`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
});

test('example mode is useful without a key and unmistakably synthetic', async () => {
  await withServer({ apiKey: '' }, async base => {
    const response = await post(base, { mode: 'example', exampleId: 'credit', budget: 0, horizonDays: 30 });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.report.mode, 'synthetic_example');
    assert.match(data.report.model, /no SERV call/);
    assert.match(data.example.label, /SYNTHETIC/);
    assert.equal(data.report.advertised_reward.type, 'credit_not_cash');
  });
});

test('live mode fails closed without a key and requires consent', async () => {
  await withServer({ apiKey: '' }, async base => {
    const sourceText = EXAMPLES.judged.text;
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.live_enabled, false);
    const noConsent = await post(base, { mode: 'live', sourceText, sourceUrl: EXAMPLES.judged.sourceUrl,
      budget: 0, horizonDays: 30, consent: false });
    assert.equal(noConsent.status, 400);
    const noKey = await post(base, { mode: 'live', sourceText, sourceUrl: EXAMPLES.judged.sourceUrl,
      budget: 0, horizonDays: 30, consent: true });
    assert.equal(noKey.status, 503);
    assert.equal((await noKey.json()).error, 'LIVE_NOT_CONFIGURED');
  });
});

test('request-size, Host, and Origin restrictions reject invalid requests', async () => {
  await withServer({ apiKey: '' }, async base => {
    const huge = await post(base, { mode: 'live', sourceText: 'x'.repeat(17_000), sourceUrl: 'https://example.com',
      budget: 0, horizonDays: 30, consent: true });
    assert.equal(huge.status, 413);
    const badOrigin = await post(base, { mode: 'example', exampleId: 'judged', budget: 0, horizonDays: 30 },
      { Origin: 'https://attacker.example' });
    assert.equal(badOrigin.status, 403);
    const badHostStatus = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: Number(new URL(base).port), path: '/api/status',
        headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(badHostStatus, 403);
  });
});

test('only public HTTPS provenance URLs are accepted', () => {
  assert.equal(validateSourceUrl('https://example.org/bounty'), 'https://example.org/bounty');
  for (const url of ['http://example.org/', 'https://localhost/a', 'https://127.0.0.1/a',
    'https://user:pass@example.org/a', 'https://intranet.local/a']) {
    assert.throws(() => validateSourceUrl(url));
  }
});

test('one mock live request uses fixed SERV endpoint and validates its quote', async () => {
  let calls = 0;
  const fakeFetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://inference-api.openserv.ai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(options.body).model, 'test-model');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(EXAMPLES.judged.extraction) } }] }), { status: 200 });
  };
  await withServer({ apiKey: 'test-key', model: 'test-model', fetchImpl: fakeFetch }, async base => {
    const response = await post(base, { mode: 'live', sourceText: EXAMPLES.judged.text,
      sourceUrl: EXAMPLES.judged.sourceUrl, budget: 0, horizonDays: 30, consent: true });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.report.mode, 'live_serv');
    assert.equal(data.report.model, 'test-model');
    assert.equal(data.report.payout_timing.status, 'unknown');
  });
  assert.equal(calls, 1);
});

test('mock live response with fabricated evidence creates no report', async () => {
  const invalid = structuredClone(EXAMPLES.judged.extraction);
  invalid.reward_amount.quote = '$999 guaranteed';
  await withServer({ apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(invalid) } }]
  }), { status: 200 }) }, async base => {
    const response = await post(base, { mode: 'live', sourceText: EXAMPLES.judged.text,
      sourceUrl: EXAMPLES.judged.sourceUrl, budget: 0, horizonDays: 30, consent: true });
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.report, undefined);
    assert.equal(data.error, 'EVIDENCE_REJECTED');
  });
});
