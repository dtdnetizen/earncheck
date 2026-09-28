// Paid runtime factory. The owning site entrypoint must call this only for
// paid API paths; the private preview can keep its separate no-payment routes.
import { createD1Store } from './d1-store.mjs';
import { createNanoPayment, EXPECTED_PAY_TO } from './nano-payment.mjs';
import { createHandler } from './worker.mjs';

const readyByBinding = new WeakMap();
// Static one-statement DDL. D1 exec splits on newlines, including inside a
// CREATE TABLE or TRIGGER, so batch prepared statements instead.
const SCHEMA_DDL = [
  "CREATE TABLE IF NOT EXISTS paid_reports (payment_id TEXT PRIMARY KEY NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
  "CREATE TABLE IF NOT EXISTS payment_intents (payment_id TEXT PRIMARY KEY NOT NULL, request_digest TEXT NOT NULL, amount_raw TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('report','prepay')), recovery_secret_sha256 TEXT, confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)), payer TEXT, created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
  "CREATE TABLE IF NOT EXISTS prepaid_packages (payment_id TEXT PRIMARY KEY NOT NULL, token_sha256 TEXT UNIQUE NOT NULL, recovery_secret_sha256 TEXT NOT NULL, total_calls INTEGER NOT NULL CHECK (total_calls > 0), remaining_calls INTEGER NOT NULL CHECK (remaining_calls >= 0 AND remaining_calls <= total_calls), created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
  "CREATE TABLE IF NOT EXISTS prepaid_reports (package_payment_id TEXT NOT NULL REFERENCES prepaid_packages(payment_id), idempotency_key TEXT NOT NULL, request_digest TEXT NOT NULL, response_json TEXT NOT NULL, created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY (package_payment_id, idempotency_key))",
  "CREATE TRIGGER IF NOT EXISTS prepaid_before_insert BEFORE INSERT ON prepaid_reports BEGIN SELECT CASE WHEN COALESCE((SELECT remaining_calls FROM prepaid_packages WHERE payment_id = NEW.package_payment_id), 0) <= 0 THEN RAISE(ABORT, 'credits_exhausted') END; END",
  "CREATE TRIGGER IF NOT EXISTS prepaid_after_insert AFTER INSERT ON prepaid_reports BEGIN UPDATE prepaid_packages SET remaining_calls = remaining_calls - 1 WHERE payment_id = NEW.package_payment_id; END"
];
// Public receive-only Copperglass business wallet; no seed or signing key here.
const PUBLIC_PAY_TO = 'nano_1q7k9k6nwdxbiewh9yetp3tsuc4ry4w9d7j7h5nb9km5bq69j7515ryxe63i';
const safeJson = (body, status) => new Response(JSON.stringify(body), { status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function ensureSchema(db) {
  let ready = readyByBinding.get(db);
  if (!ready) {
    ready = Promise.resolve().then(() => db.batch(SCHEMA_DDL.map(sql => db.prepare(sql))));
    readyByBinding.set(db, ready);
    ready.catch(() => { if (readyByBinding.get(db) === ready) readyByBinding.delete(db); });
  }
  await ready;
}

function logSchemaError(error) {
  const message = String(error?.message ?? error).replace(/[\r\n\t]+/g, ' ').slice(0, 300);
  console.error('static D1 schema initialization failed:', message);
}

export function createRuntime(env, { fetchImpl = fetch } = {}) {
  const enabled = env?.PAYMENTS_ENABLED === 'true';
  const storageConfigured = Boolean(env?.DB?.prepare && env?.DB?.batch);
  const keyConfigured = typeof env?.CAPABILITY_HMAC_KEY === 'string' && env.CAPABILITY_HMAC_KEY.length >= 32;
  const configured = storageConfigured && keyConfigured && PUBLIC_PAY_TO === EXPECTED_PAY_TO;
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' && path === '/health') {
        if (!storageConfigured) return safeJson({ status: enabled ? 'configuration_missing' : 'preview',
          payments_enabled: false, storage_ready: false, key_ready: keyConfigured }, enabled ? 503 : 200);
        try {
          await ensureSchema(env.DB);
          return safeJson({ status: enabled ? (configured ? 'ready' : 'configuration_missing') : 'preview',
            payments_enabled: enabled && configured, storage_ready: true, key_ready: keyConfigured },
            enabled && !configured ? 503 : 200);
        } catch (error) { logSchemaError(error); return safeJson({ status: 'database_unavailable', payments_enabled: false,
          storage_ready: false, key_ready: keyConfigured }, 503); }
      }
      if (!enabled) return safeJson({ error: 'payments_disabled' }, 503);
      if (!configured) return safeJson({ error: 'configuration_missing' }, 503);
      try { await ensureSchema(env.DB); }
      catch (error) { logSchemaError(error); return safeJson({ error: 'database_unavailable' }, 503); }
      const store = createD1Store(env.DB);
      const payment = createNanoPayment({ payTo: PUBLIC_PAY_TO, store, fetchImpl });
      return createHandler({ payment, store, capabilityKey: env.CAPABILITY_HMAC_KEY })(request);
    }
  };
}
