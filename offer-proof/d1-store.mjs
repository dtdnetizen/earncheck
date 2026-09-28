// Inject a Cloudflare D1-compatible database explicitly. No Sites binding
// name is assumed by this module.
export function createD1Store(db) {
  if (!db?.prepare) throw new Error('db_required');
  return {
    async reservePayment(paymentId, requestDigest, amountRaw, purpose, recoverySecretSha256 = null) {
      await db.prepare(`INSERT OR IGNORE INTO payment_intents
        (payment_id, request_digest, amount_raw, purpose, recovery_secret_sha256)
        VALUES (?, ?, ?, ?, ?)`).bind(paymentId, requestDigest, amountRaw, purpose, recoverySecretSha256).run();
      const row = await db.prepare(`SELECT request_digest, amount_raw, purpose, recovery_secret_sha256,
        confirmed, payer FROM payment_intents WHERE payment_id = ?`).bind(paymentId).first();
      if (!row || row.request_digest !== requestDigest || row.amount_raw !== amountRaw ||
          row.purpose !== purpose || row.recovery_secret_sha256 !== recoverySecretSha256)
        throw new Error('payment_reserved_for_other_request');
      return { confirmed: row.confirmed === 1, payer: row.payer };
    },
    async confirmPayment(paymentId, payer) {
      await db.prepare('UPDATE payment_intents SET confirmed = 1, payer = ? WHERE payment_id = ?')
        .bind(payer, paymentId).run();
      const row = await db.prepare('SELECT confirmed FROM payment_intents WHERE payment_id = ?')
        .bind(paymentId).first();
      if (row?.confirmed !== 1) throw new Error('confirmation_write_failed');
    },
    async getPaymentIntent(paymentId) {
      return db.prepare(`SELECT request_digest, amount_raw, purpose, recovery_secret_sha256,
        confirmed, payer FROM payment_intents WHERE payment_id = ?`).bind(paymentId).first();
    },
    async createPackage(paymentId, tokenSha256, recoverySecretSha256) {
      await db.prepare(`INSERT OR IGNORE INTO prepaid_packages
        (payment_id, token_sha256, recovery_secret_sha256, total_calls, remaining_calls)
        SELECT payment_id, ?, ?, 1000, 1000 FROM payment_intents
        WHERE payment_id = ? AND purpose = 'prepay' AND confirmed = 1
          AND recovery_secret_sha256 = ?`).bind(tokenSha256, recoverySecretSha256, paymentId, recoverySecretSha256).run();
      const row = await db.prepare('SELECT token_sha256, recovery_secret_sha256, remaining_calls FROM prepaid_packages WHERE payment_id = ?')
        .bind(paymentId).first();
      if (!row || row.token_sha256 !== tokenSha256 || row.recovery_secret_sha256 !== recoverySecretSha256)
        throw new Error('package_write_failed');
      return row.remaining_calls;
    },
    async usePackage(tokenSha256, idempotencyKey, requestDigest, response) {
      const pkg = await db.prepare('SELECT payment_id FROM prepaid_packages WHERE token_sha256 = ?')
        .bind(tokenSha256).first();
      if (!pkg) throw new Error('package_not_found');
      try {
        await db.prepare(`INSERT INTO prepaid_reports
          (package_payment_id, idempotency_key, request_digest, response_json)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS
            (SELECT 1 FROM prepaid_reports WHERE package_payment_id = ? AND idempotency_key = ?)
          ON CONFLICT(package_payment_id, idempotency_key) DO NOTHING`)
          .bind(pkg.payment_id, idempotencyKey, requestDigest, JSON.stringify(response), pkg.payment_id, idempotencyKey).run();
      } catch (error) {
        if (String(error).includes('credits_exhausted')) throw new Error('credits_exhausted');
        throw error;
      }
      const row = await db.prepare(`SELECT r.request_digest, r.response_json, p.remaining_calls
        FROM prepaid_reports r JOIN prepaid_packages p ON p.payment_id = r.package_payment_id
        WHERE r.package_payment_id = ? AND r.idempotency_key = ?`).bind(pkg.payment_id, idempotencyKey).first();
      if (!row) throw new Error('report_write_failed');
      if (row.request_digest !== requestDigest) throw new Error('idempotency_key_reused');
      return { response: JSON.parse(row.response_json), remainingCalls: row.remaining_calls };
    },
    async get(paymentId) {
      const row = await db.prepare('SELECT request_digest, response_json FROM paid_reports WHERE payment_id = ?')
        .bind(paymentId).first();
      return row ? { requestDigest: row.request_digest, response: JSON.parse(row.response_json) } : null;
    },
    async putIfAbsent(paymentId, requestDigest, response) {
      await db.prepare('INSERT OR IGNORE INTO paid_reports(payment_id, request_digest, response_json) VALUES (?, ?, ?)')
        .bind(paymentId, requestDigest, JSON.stringify(response)).run();
      const saved = await this.get(paymentId);
      if (!saved) throw new Error('durable_write_failed');
      return saved;
    }
  };
}
