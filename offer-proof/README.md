# Copperglass Offer Proof Gate

Source for the public [Offer Proof Gate](https://copperglass-offer-proof.pages.dev/). It checks whether exact quotes in **caller-supplied public offer text** support up to five extracted claims. The caller also supplies a source URL for provenance; the service does not fetch it. A report can say `quote_matches`, `quote_conflicts`, or `uncheckable`. None of those outcomes verifies that an offer is current, funded, legitimate, or payable.

**Status, 28 September 2026:** The site is publicly deployed. One **same-operator** 0.01 XNO live payment returned HTTP 200 with a persisted report after a Cloudflare outbound redirect-mode fix; the original send confirmed on Nano mainnet. An identical signed request replay returned the stored report, a changed-body reuse returned HTTP 409, and replaying the original body still returned the stored report. The operator received the payment back into its own business wallet: the business balance returned to 6 XNO, the test wallet ended at zero, and both had zero receivable at the final check. This verifies one direct payment path, **not** an independent customer, a new sale, or new income. The 10 XNO prepaid flow has been tested locally with mocks and SQLite, not with a live funded purchase. One successful self-test does not establish long-term facilitator availability or market demand.

## Public routes

- [`GET /`](https://copperglass-offer-proof.pages.dev/) — overview and free synthetic demo.
- [`GET /docs`](https://copperglass-offer-proof.pages.dev/docs) — input shape, narrow quote grammar, limits, and prices.
- [`GET /sample-input.json`](https://copperglass-offer-proof.pages.dev/sample-input.json) — invented `.example` fixture.
- [`GET /demo`](https://copperglass-offer-proof.pages.dev/demo) — free result for that fixture.
- [`GET /health`](https://copperglass-offer-proof.pages.dev/health) — configuration readiness, without secret values.
- [`GET /llms.txt`](https://copperglass-offer-proof.pages.dev/llms.txt) — concise agent-facing contract.
- `POST /v1/offer-proof` — one bounded report, quoted at 0.01 XNO on Nano mainnet when the paid runtime is configured.
- `POST /v1/prepay` and `POST /v1/prepay/recover` — 10 XNO/1,000-call capability flow; locally tested only.

Paid calls use a signed, unbroadcast Nano state send in the x402 v2 `PAYMENT-SIGNATURE` header. The service verifies and reserves the payment hash for one request before asking the fixed facilitator to settle. If a response is uncertain, a client should reconcile the **same** block hash and retry the same signed block and body; it should not sign another send just because a request timed out. Keep capability and recovery secrets private. Do not put passwords, tokens, private messages, or personal data in offer text.

## Local development

Requires Node.js and Python 3. The lockfile pins the build dependency; `npm ci` is the normal install step. No wallet seed or HMAC value is in this repository.

```sh
npm ci
npm test
python schema_test.py
npm run build
```

`npm run build` bundles `site-worker.mjs` to `dist/index.js` for a Cloudflare Pages Worker. The runtime expects a D1 binding named `DB` and a private `CAPABILITY_HMAC_KEY` of at least 32 characters. Paid routes fail closed unless `PAYMENTS_ENABLED` is exactly `true` and both bindings are ready. Configure secret values through the host; never commit them. Local tests use mocks or SQLite and make no funded payment. `sample.mjs` regenerates the synthetic output.

## Layout and rights

- `site-worker.mjs` is the clean entrypoint; this publication candidate omits the temporary facilitator diagnostic route used during an internal egress investigation.
- `core.mjs`, `worker.mjs`, `runtime.mjs`, `d1-store.mjs`, and `schema.sql` implement quote checks, API handling, runtime configuration, and durable report/payment state.
- `nano-payment.mjs` and `nano-hash.mjs` implement the fixed Nano x402 adapter and block hashing. The Worker contains no wallet signing key and cannot create a payer send.
- `*.test.mjs` and `schema_test.py` cover the grammar, payment reservation/replay, prepaid accounting, and runtime configuration with local fixtures.
- `vendor/noble-hashes/` is a vendored subset of `@noble/hashes` 1.3.2 under its MIT license. See its `LICENSE` and `LICENSES.md` for notices.

Original application source is available under the MIT License in `LICENSE`. The synthetic fixture is invented and does not describe a real buyer or funded offer. This directory is a **local publication candidate**; preparing it did not create a GitHub repository, push code, or deploy a new version.
