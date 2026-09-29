import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const fixture = `Meeting: School fair planning
ACTION | owner=Alex | task=Ask the PTA for volunteer slots | due=2026-10-07 | time=18:00 | email=pta@example.invalid
ACTION | owner=Sam | task=Confirm snack list | due=2026-10-08 | time= | email=
ACTION | owner=Lee | task=Check bus schedule | due= | time= | email=`;

const sourceCode = `return [{ json: { source: 'SYNTHETIC_MEETING_NOTE', note: ${JSON.stringify(fixture)} } }];`;

const draftCode = String.raw`
const input = $input.first().json;
if (input.source !== 'SYNTHETIC_MEETING_NOTE' || typeof input.note !== 'string') {
  throw new Error('Expected synthetic meeting note fixture');
}
const lines = input.note.split(/\r?\n/);
const meeting = (lines.find(line => line.startsWith('Meeting:')) || '').slice(8).trim();
const actions = [];
const issues = [];
for (const [index, line] of lines.entries()) {
  if (!line.startsWith('ACTION |')) continue;
  const fields = {};
  for (const segment of line.split('|').slice(1)) {
    const equals = segment.indexOf('=');
    if (equals > 0) fields[segment.slice(0, equals).trim()] = segment.slice(equals + 1).trim();
  }
  const id = 'A' + String(actions.length + 1).padStart(2, '0');
  if (!fields.task || !fields.owner) {
    issues.push({ line: index + 1, reason: 'Missing task or owner' });
    continue;
  }
  const dueText = fields.due || '';
  const dueTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(dueText)
    ? Date.parse(dueText + 'T00:00:00Z') : NaN;
  const validDue = !Number.isNaN(dueTimestamp) &&
    new Date(dueTimestamp).toISOString().slice(0, 10) === dueText;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(fields.time || '');
  const calendarDraft = validDue && validTime ? {
    title: fields.task, localDate: fields.due, localTime: fields.time,
    timeZone: 'America/Los_Angeles', attendee: fields.owner,
    note: 'Proposed only. Confirm duration and participants before adding to a calendar.'
  } : null;
  const emailDraft = fields.email ? {
    to: fields.email, subject: 'School fair: ' + fields.task,
    body: 'Hi,\n\nCould you help us with: ' + fields.task + '?\n\nThanks,\nThe family',
    note: 'Draft only; confirm recipient and wording.'
  } : null;
  const reviewReasons = [];
  if (!validDue) reviewReasons.push('Confirm due date');
  if (fields.time && !validTime) reviewReasons.push('Invalid proposed time');
  if (!calendarDraft) reviewReasons.push('No calendar proposal without a valid date and time');
  actions.push({ id, task: fields.task, owner: fields.owner, due: validDue ? fields.due : null,
    calendarDraft, emailDraft, reviewReasons });
}
return [{ json: { meeting, source: input.source, status: 'PENDING_HUMAN_REVIEW',
  actions, issues, externalWrites: 0 } }];`;

const gateCode = String.raw`
const packet = $input.first().json;
// Human reviewer must edit this sample decision after inspecting every action.
// There are no downstream integration nodes even when approved.
const decision = { approved: false, approver: '', reviewedActionIds: [] };
const ids = packet.actions.map(action => action.id);
const complete = decision.approved === true && decision.approver.trim().length > 0 &&
  ids.length > 0 && ids.every(id => decision.reviewedActionIds.includes(id)) &&
  decision.reviewedActionIds.length === ids.length && packet.issues.length === 0;
return [{ json: { ...packet, approval: {
  status: complete ? 'APPROVED_FOR_MANUAL_HANDOFF' : 'PENDING_HUMAN_REVIEW',
  approver: complete ? decision.approver : null,
  reviewedActionIds: complete ? ids : [],
  note: 'Approval is a local demonstration. No calendar or email write is connected.'
}, externalWrites: 0 } }];`;

const nodes = [
  { id: 'manual-trigger', name: 'Run synthetic sample', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [240, 300], parameters: {} },
  { id: 'synthetic-note', name: 'Synthetic meeting note', type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 300], parameters: { mode: 'runOnceForAllItems', jsCode: sourceCode } },
  { id: 'draft-review', name: 'Extract and draft review packet', type: 'n8n-nodes-base.code', typeVersion: 2, position: [680, 300], parameters: { mode: 'runOnceForAllItems', jsCode: draftCode } },
  { id: 'approval-gate', name: 'Human approval gate - default pending', type: 'n8n-nodes-base.code', typeVersion: 2, position: [900, 300], parameters: { mode: 'runOnceForAllItems', jsCode: gateCode } },
];
const connections = Object.fromEntries(nodes.slice(0, -1).map((node, i) => [node.name, { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] }]));
const workflow = { name: 'Household meeting notes to review drafts (synthetic, no writes)', nodes,
  connections, active: false, settings: { executionOrder: 'v1' }, pinData: {}, tags: [] };
writeFileSync(join(here, 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('Wrote workflow.json');
