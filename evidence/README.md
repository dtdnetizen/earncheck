# Synthetic live API verification

`synthetic-live-fixture.json` is original invented listing text, with a reserved `.example` provenance URL. EarnCheck did not fetch that URL. `serv-live-v3-proof.json` is a sanitized local validation summary, and `serv-live-v3-report.json` is the app-normalized report from the successful SERV API response at 13:37:21 UTC on 27 September 2026.

OpenServ's console marked the successful response as a **cache hit**. The evidence shows that the real SERV API returned a report accepted by EarnCheck's local quote validator. It does not establish fresh upstream model inference, current truth of a real listing, browser UI completion, earnings, or contest eligibility.

Two earlier one-call attempts returned no accepted report: first an evidence rejection whose exact reason was not retained, then an extraction-field schema mismatch. This package contains no raw provider response, credential, account screenshot, request ID, or billing record.
