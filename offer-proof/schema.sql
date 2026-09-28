-- Execute on a dedicated durable SQL database before enabling paid requests.
-- Nano block hashes are unique; the service must never consume one for a changed body.
CREATE TABLE IF NOT EXISTS paid_reports (
  payment_id TEXT PRIMARY KEY NOT NULL,
  request_digest TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- The expected hash is computed from the client's signed state block. Reserve
-- before /settle so one send cannot attach to two different requests/packages.
CREATE TABLE IF NOT EXISTS payment_intents (
  payment_id TEXT PRIMARY KEY NOT NULL,
  request_digest TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('report','prepay')),
  recovery_secret_sha256 TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)),
  payer TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS prepaid_packages (
  payment_id TEXT PRIMARY KEY NOT NULL,
  token_sha256 TEXT UNIQUE NOT NULL,
  recovery_secret_sha256 TEXT NOT NULL,
  total_calls INTEGER NOT NULL CHECK (total_calls > 0),
  remaining_calls INTEGER NOT NULL CHECK (remaining_calls >= 0 AND remaining_calls <= total_calls),
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS prepaid_reports (
  package_payment_id TEXT NOT NULL REFERENCES prepaid_packages(payment_id),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (package_payment_id, idempotency_key)
);

-- Trigger executes only on a newly inserted idempotency key. Its decrement is
-- in the same SQLite transaction as the report insert, even under concurrent
-- requests. A replay does not consume another call.
CREATE TRIGGER IF NOT EXISTS prepaid_before_insert
BEFORE INSERT ON prepaid_reports
BEGIN
  SELECT CASE WHEN COALESCE((SELECT remaining_calls FROM prepaid_packages
    WHERE payment_id = NEW.package_payment_id), 0) <= 0
    THEN RAISE(ABORT, 'credits_exhausted') END;
END;

CREATE TRIGGER IF NOT EXISTS prepaid_after_insert
AFTER INSERT ON prepaid_reports
BEGIN
  UPDATE prepaid_packages SET remaining_calls = remaining_calls - 1
    WHERE payment_id = NEW.package_payment_id;
END;
