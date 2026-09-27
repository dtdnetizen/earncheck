# EarnCheck release status

**27 September 2026**

EarnCheck is an original, AI-assisted local demo. Its three examples are synthetic and clearly labelled. Example mode runs without an account or API key and makes no SERV request.

The local API made three single SERV requests on the original synthetic fixture. The first returned `EVIDENCE_REJECTED` without a retained exact reason. The second returned `EVIDENCE_REJECTED` because extraction fields did not match the allowed schema. The third returned HTTP 200 at 13:37:21 UTC with a validated `live_serv` report from `gpt-6-luna`: nine exact citations, zero awards remaining, and unknown payout timing. OpenServ's console marked this successful response as a **cache hit**. It proves this API path returned a validated report, not fresh upstream model inference or performance on other inputs.

The original synthetic fixture, sanitized success proof, and normalized report are in [`evidence/`](evidence/). The supplied `.example` URL is a provenance label, not a fetched page. No full browser UI live-flow screenshot has been captured. The interface is not deployed publicly.

`docs/index.html` is a static recorded-result viewer for that saved response. It sends no SERV request and is separate from the local Node application that performs analysis. The planned GitHub Pages URL is [dtdnetizen.github.io/earncheck](https://dtdnetizen.github.io/earncheck/); publication and Pages enablement are pending, so this release does not claim that site is live.

The public Node suite passed **22 of 22** tests on 27 September 2026, including strict schema forwarding, rejection of a fabricated quote, local HTTP controls, and example-mode behavior. These are local tests with mocked upstream responses.

The included screenshots show synthetic example mode. Training/data-collection opt-in was off or pending at verification. No hackathon entry or eligibility is claimed, and no earnings are claimed.
