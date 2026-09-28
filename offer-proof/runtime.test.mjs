import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: [fileURLToPath(new URL('./runtime.mjs', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', loader: { '.sql': 'text' } });
const { createRuntime } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
const health = new Request('https://seller.example/health');
const paid = new Request('https://seller.example/v1/offer-proof', { method: 'POST', body: '{}' });

test('payment kill switch permits a static schema readiness probe but no paid handling', async () => {
  let batches = 0;
  const db = { batch: async statements => { batches++; assert.equal(statements.length, 6); },
    prepare: sql => { assert.equal(sql.includes('\n'), false); return sql; },
    exec: () => { throw new Error('multiline exec must not be used'); } };
  const runtime = createRuntime({ PAYMENTS_ENABLED: 'false', DB: db });
  const probe = await runtime.fetch(health);
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), { status: 'preview', payments_enabled: false,
    storage_ready: true, key_ready: false });
  const answer = await runtime.fetch(paid);
  assert.equal(answer.status, 503);
  assert.equal((await answer.json()).error, 'payments_disabled');
  assert.equal(batches, 1);
});

test('missing DB or HMAC key fails closed without exposing configuration', async () => {
  const runtime = createRuntime({ PAYMENTS_ENABLED: 'true' });
  const answer = await runtime.fetch(paid);
  assert.equal(answer.status, 503);
  assert.deepEqual(await answer.json(), { error: 'configuration_missing' });
  const probe = await runtime.fetch(health);
  assert.equal(probe.status, 503);
  assert.equal((await probe.json()).storage_ready, false);
});

test('schema initializes once per binding and retries after a failed initialization', async () => {
  let attempts = 0;
  const db = { prepare: sql => sql, batch: async statements => {
    attempts++;
    assert.equal(statements.length, 6);
    assert.match(statements[1], /CREATE TABLE IF NOT EXISTS payment_intents/);
    assert.match(statements[4], /CREATE TRIGGER IF NOT EXISTS prepaid_before_insert/);
    if (attempts === 1) throw new Error('mock DB failure');
  }, exec: () => { throw new Error('multiline exec must not be used'); } };
  const runtime = createRuntime({ PAYMENTS_ENABLED: 'true', DB: db, CAPABILITY_HMAC_KEY: 'x'.repeat(48) });
  const failed = await runtime.fetch(health);
  assert.equal(failed.status, 503);
  const results = await Promise.all([runtime.fetch(health), runtime.fetch(health)]);
  assert.deepEqual(results.map(x => x.status), [200, 200]);
  assert.equal(attempts, 2);
  const body = await results[0].json();
  assert.deepEqual(body, { status: 'ready', payments_enabled: true, storage_ready: true, key_ready: true });
});
