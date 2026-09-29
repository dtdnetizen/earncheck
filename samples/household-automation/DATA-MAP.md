# Proposed data map for a first milestone

This is a design proposal based on the public posting, not a map of the family's actual systems.

| Data | Proposed location | Proposed movement | Control to confirm |
| --- | --- | --- | --- |
| Raw meeting notes | Source service, then home Mac mini | Fetch only the selected meeting after consent | Confirm source permissions and retention; redact private details before optional cloud processing. |
| Extracted action items | Home n8n and approved family task store | Only reviewed fields move to Notion if the family chooses it | Keep source reference, owner and due date; mark uncertain fields for review. |
| Calendar proposal | Home n8n review queue | Google Calendar only after named human approval | Review date, time zone, duration and participants; prevent duplicates with a stable source ID. |
| Email draft | Home n8n review queue | Gmail draft creation only after review, if enabled | Review recipient and wording; sending remains a separate explicit human action. |
| Sensitive documents and local search index | Home Mac mini | No cloud AI transfer by default | Define folders, local access, encryption, backup and deletion policy. |
| Logs | Home n8n | Alert metadata may go to an agreed channel | Avoid note text or document contents in alerts; set retention and access. |

The demo moves none of this data. It uses only a synthetic note and an `example.invalid` address. The first real workshop should decide whether notes themselves may leave the source service, which adults approve actions, and whether Notion or Google receives each approved field.
