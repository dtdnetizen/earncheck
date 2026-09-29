import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const workflow = JSON.parse(readFileSync(new URL('./workflow.json', import.meta.url)));
assert.equal(workflow.active, false);
assert.deepEqual(workflow.nodes.map(node => node.type), [
  'n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code',
  'n8n-nodes-base.code', 'n8n-nodes-base.code']);
assert.equal(Object.keys(workflow.connections).length, 3);
assert.ok(workflow.nodes.every(node => !node.credentials));
assert.deepEqual(Object.keys(workflow.connections), workflow.nodes.slice(0, -1).map(node => node.name));
for (const [index, node] of workflow.nodes.slice(0, -1).entries()) {
  assert.equal(workflow.connections[node.name].main[0][0].node, workflow.nodes[index + 1].name);
}

function execute(name, input) {
  const code = workflow.nodes.find(node => node.name === name).parameters.jsCode;
  const context = { $input: { first: () => ({ json: input }) } };
  return runInNewContext(`(() => { ${code} })()`, context)[0].json;
}
const sample = execute('Synthetic meeting note');
const packet = execute('Extract and draft review packet', sample);
const result = execute('Human approval gate - default pending', packet);
assert.equal(packet.actions.length, 3);
assert.equal(packet.actions[0].calendarDraft.timeZone, 'America/Los_Angeles');
assert.equal(packet.actions[0].emailDraft.to, 'pta@example.invalid');
assert.equal(packet.actions[1].calendarDraft, null);
assert.equal(packet.actions[2].due, null);
assert.equal(result.approval.status, 'PENDING_HUMAN_REVIEW');
assert.equal(result.externalWrites, 0);
assert.equal(execute('Extract and draft review packet', { ...sample, note: 'Meeting: Invalid\nACTION | owner= | task=Bad | due=2026-10-07 | time=18:00 | email=' }).issues.length, 1);
for (const invalidDate of ['2026-02-29', '2026-02-30', '2026-13-01']) {
  const invalid = execute('Extract and draft review packet', { ...sample,
    note: `Meeting: Invalid date\nACTION | owner=Alex | task=Check date | due=${invalidDate} | time=18:00 | email=` });
  assert.equal(invalid.actions[0].due, null);
  assert.equal(invalid.actions[0].calendarDraft, null);
  assert.ok(invalid.actions[0].reviewReasons.includes('Confirm due date'));
}
console.log('PASS: workflow structure, credentials absent, synthetic parsing, draft proposals, missing-data hold, default approval hold, zero external writes');
