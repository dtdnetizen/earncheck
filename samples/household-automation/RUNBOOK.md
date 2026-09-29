# Plain-language runbook

## What this sample does

Press **Execute workflow** in an isolated n8n copy. An invented school-fair note enters the flow. The workflow lists three action items, proposes one calendar entry, and writes one email draft as text. Missing dates or times stay visibly incomplete. The final result says `PENDING_HUMAN_REVIEW`. Nothing is sent, scheduled, or saved to an outside account.

## Check the result

1. Open the result of **Extract and draft review packet**. Read each task and owner against the note. Check the date, time zone, email address, and email wording. A blank date or time means no calendar proposal.
2. Open **Human approval gate - default pending**. Its status should be `PENDING_HUMAN_REVIEW` and `externalWrites` should be `0`.
3. If a proposal looks wrong, correct the source note or extraction rule before any real connector is added. Never treat an AI extraction as a final instruction.

## If it fails

- **No actions:** Check that each relevant line starts with `ACTION |` and has `owner=` and `task=`. The real implementation should accept the selected notes provider's format rather than require this toy format.
- **No calendar proposal:** Confirm a real `YYYY-MM-DD` due date and a 24-hour `HH:MM` time. The sample does not guess missing values or duration.
- **Unexpected output:** Stop the run, keep the workflow inactive, and inspect the execution and source note. Do not add a send or calendar node until the case is understood.
- **Service unavailable in a real build:** Keep the review queue, record a failure without private note text, alert a named household adult, and retry only safe/idempotent steps after connectivity returns. These are requirements to implement and test, not functions this sample already provides.

## Before a real launch

Agree on allowed data, approvers, local hosting and backups. Connect one notes source and one destination in a test account. Use real human approval outside a Code node, make calendar writes idempotent, create Gmail **drafts** rather than send, and test failure alerts and recovery with non-sensitive fixtures. Document how the household can pause the workflow and rotate credentials. Recheck integrations on a schedule agreed with the family.
