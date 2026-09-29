# Household workflow sample

An **inactive** n8n workflow JSON designed for the [household CTO posting](https://community.n8n.io/t/hiring-part-time-household-cto-n8n-notion-local-llm-home-setup-la-remote/315978). It uses invented meeting notes to produce action items, a proposed calendar entry, and an email draft. The last node marks the output `PENDING_HUMAN_REVIEW`; it does not pause execution or create a review queue. It has no credentials, external trigger, API call, send node, or calendar write node.

## What to inspect

- `workflow.json`: n8n workflow, generated from `build-workflow.mjs`.
- `test-workflow.mjs`: local structural and embedded JavaScript checks.
- `DATA-MAP.md`: data boundaries for a proposed real implementation.
- `RUNBOOK.md`: plain-language sample use, failures, and next steps.

## Local check

From this folder, run `node build-workflow.mjs` then `node test-workflow.mjs`. These checks execute the Code-node JavaScript in a Node VM with a mocked `$input`. They do **not** execute n8n or verify import compatibility. No local n8n executable or container runtime was found in this workspace environment on 2026-09-29.

## Using the sample in n8n

Import `workflow.json` into a disposable local n8n instance and keep it inactive. Manually run it, then inspect `Extract and draft review packet` and `Human approval gate - default pending`. Review every action, date, recipient and body. The sample gate defaults to pending; its comments show the fields a reviewer would have to enter to simulate approval. Even simulated approval creates no external change.

This is a proof of the proposed *shape* of the first workflow, not a household deployment or an integration with Fathom, Granola, Notion, Google Workspace, Ollama or Claude. A real first milestone needs agreement on data sources, users, approval channel, retention, credentials, failure alerts, and acceptance tests before connecting any service.
