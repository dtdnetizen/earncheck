# EarnCheck

EarnCheck is a local, source-text-only bounty triage desk. Paste public listing text and its URL, then inspect advertised reward type, award availability, fees, payout timing, and exact supporting quotes. The URL is **user supplied provenance**; EarnCheck never fetches or authenticates it. A matching quote proves that text is present, not that a buyer's claim is true or current. The app never predicts earnings.

## Status

- Local interface and three clearly labelled **synthetic examples** work without a key. No SERV call occurs in example mode.
- A real `gpt-6-luna` SERV API call on 27 September 2026 returned a validated report for the included original synthetic fixture. OpenServ's console marked the successful response as a **cache hit**; this does not prove fresh upstream model inference. Its sanitized proof and normalized report are in [`evidence/`](evidence/). Two earlier single calls produced no report: one failed evidence validation, and one returned an extraction schema mismatch. The successful response does not establish performance on other listings.
- The source repository and recorded-result viewer are public. No payment or hackathon submission is claimed.

The [recorded result viewer](https://dtdnetizen.github.io/earncheck/) is live on GitHub Pages and shows the saved synthetic SERV API result. The served HTML was verified byte-for-byte against [`docs/index.html`](docs/index.html) on 27 September 2026. It makes no API call and cannot analyze new listings. The [public source repository](https://github.com/dtdnetizen/earncheck) includes the local Node server and browser application used for new analyses; that application is not hosted on Pages.

## Run locally

Node.js 20 or later; no package install or runtime dependencies.

```powershell
cd earncheck
npm test
npm start
```

Open `http://127.0.0.1:8765/`. The server only binds to `127.0.0.1` and rejects other Host and Origin headers. Change the port with `EARN_PORT` if required. Do not bind this demo to a public interface.

Click any example button. The examples are invented and use the reserved `.example` domain. The default case deliberately shows an **open** badge with **zero remaining awards**; the report marks the award unavailable despite the open wording. Other cases separate API credit from withdrawable cash and show a judged cash prize with unknown payout timing.

## Live SERV setup

See [SERV-SETUP.md](SERV-SETUP.md). The server reads `SERV_API_KEY` from its process environment; it never sends the key to the browser or saves it in the project. `SERV_MODEL` defaults to `gpt-6-luna`, an ID in the [official model catalog](https://docs.openserv.ai/serv-reasoning/models). The server uses the fixed [chat completions endpoint](https://docs.openserv.ai/serv-reasoning/api/chat-completions) at `https://inference-api.openserv.ai/v1/chat/completions`. OpenServ's [API overview](https://docs.openserv.ai/serv-reasoning/api) requires a system prompt; this request includes one. The call sets `max_completion_tokens: 1100`, a 25-second timeout, and makes no retries or additional model calls. Current official documentation was checked on 27 September 2026.

Live mode requires the operator to affirm that the pasted text is public or synthetic and contains no private buyer or account data. The browser sends that text to the local server; the server sends it only to the fixed SERV endpoint. It does not fetch the source URL, log input text, or persist it. The request uses a strict JSON response schema generated from the local 12-field validator map; the local quote validator still checks the response. The user can download a report JSON that intentionally contains quote snippets, source URL, input hash, timestamp, model, and mode; handle that file according to the source's sensitivity.

## Evidence model

The extraction schema has exact fields for reward type/amount/unit, listing status, award capacity/remaining count, deadline, payout timing, entry fee/amount/unit, and entry requirements. Every non-null value needs an exact substring of the supplied text. Unknown facts use `{ "value": null, "quote": null }`.

The deterministic validator rejects missing or extra fields, invented quotes, impossible values, mixed numeric quotes, a credit presented as cash, a fee amount quoted as a reward, a "no refund" sentence presented as no entry fee, and an announcement of future timing presented as a payout schedule. The report compares a numeric fee to the USD budget only when its quoted unit is explicitly `USD`; other or absent units stay unknown. It marks zero remaining awards unavailable even if the text says open. These checks reduce obvious overstatements; they do **not** establish truth or complete interpretation.

The report distinguishes:

1. **Advertised value:** not earnings or an expected payout.
2. **Award availability:** only what the supplied text states; status may have changed.
3. **Entry cost:** unknown costs may remain even if an entry fee is not stated.
4. **Payout timing:** desired horizon fit is always unverified without independent confirmation.

The UI inserts model and user text through `textContent`, not HTML parsing. API output is capped, parsed as JSON, validated, and rejected if unsupported. The local endpoint accepts at most 16 KiB per request and 10,000 source characters. The only remote destination is the fixed SERV HTTPS endpoint. A live failure returns a sanitized category such as `SERV_HTTP_ERROR`, `MALFORMED_EXTRACTION_JSON`, or `EVIDENCE_REJECTED`; it never echoes provider response bodies, keys, or pasted listing text.

## Tests and files

`npm test` runs focused validation and HTTP tests covering fabricated citations, credit versus cash, exhausted capacity, unknown timing, unsafe HTML as text, consent/key fail-closed behavior, request-size and Host/Origin restrictions, one mocked fixed-endpoint call, strict response-schema forwarding, and invalid model evidence. `preview-desktop.png` is a CUA screenshot of the **synthetic example**, not a live SERV result. The successful live evidence is an API call; a full browser UI live-flow screenshot has not been captured.

- `server.mjs`: localhost HTTP server and fixed SERV integration.
- `core.mjs`: extraction schema, validation, and conservative report.
- `examples.mjs`: invented examples and prewritten extractions.
- `index.html`, `styles.css`, `app.js`, `dom.mjs`: responsive interface.
- `test/`: dependency-free Node test suite.
- `evidence/`: nonprivate synthetic input, sanitized one-call proof, and normalized report from the successful live API verification.
- `docs/index.html`: static recorded result viewer prepared for GitHub Pages; it is separate from the local API application.

## Hackathon boundary

The [official hackathon page](https://www.openserv.ai/hackathon) lists the Open Track, no application fee, starter API access, and a 28 September 2026 00:00 UTC submission cutoff. It requires data collection enabled in the OpenServ console, a public X post tagging `@openservai`, and the official form. This repository makes none of those actions. Training/data-collection opt-in remained off or pending at the live verification; no hackathon entry or eligibility is claimed.
