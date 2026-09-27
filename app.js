import { textElement } from './dom.mjs';

const $ = id => document.getElementById(id);
const sourceUrl = $('source-url');
const listingText = $('listing-text');
const budget = $('budget');
const horizon = $('horizon');
const consent = $('consent');
const notice = $('notice');
const output = $('report-output');
const liveButton = $('live-button');
const downloadButton = $('download-button');
let lastReport = null;
let liveEnabled = false;
let activeExample = null;
let requestGeneration = 0;

function el(tag, className, content) {
  return textElement(document, tag, className, content);
}

function setNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle('error', isError);
}

function invalidateReport(message = 'Inputs changed. Run an example or a live analysis for a current report.') {
  requestGeneration++;
  lastReport = null;
  downloadButton.disabled = true;
  output.replaceChildren();
  $('mode-chip').textContent = 'NO CURRENT REPORT';
  setNotice(message);
}

function updateCount() { $('character-count').textContent = `${listingText.value.length.toLocaleString()} / 10,000 characters`; }
function prefs() { return { budget: Number(budget.value), horizonDays: Number(horizon.value) }; }
function cleanLabel(value) { return String(value ?? 'Unknown').replaceAll('_', ' '); }
function money(amount, unit) {
  if (amount === null) return 'Unknown';
  if (unit === '$') return `$${amount}`;
  return `${amount} ${unit ?? '(unit unknown)'}`;
}

function metric(label, value, detail, tone) {
  const card = el('div', `metric ${tone ?? ''}`);
  card.append(el('span', 'metric-label', label), el('strong', '', value), el('small', '', detail));
  return card;
}

function reportRow(parent, name, value) {
  const row = el('div', 'assessment');
  row.append(el('b', '', name), el('span', '', value));
  parent.append(row);
}

function section(title) {
  const node = el('section', 'report-section');
  node.append(el('h4', '', title));
  output.append(node);
  return node;
}

function renderReport(report, example) {
  lastReport = report;
  downloadButton.disabled = false;
  output.replaceChildren();
  const synthetic = report.mode === 'synthetic_example';
  $('mode-chip').textContent = synthetic ? 'EXAMPLE MODE' : 'LIVE SERV MODE';
  setNotice(synthetic ? 'SYNTHETIC EXAMPLE — invented content. No SERV call was made.' :
    'LIVE SERV EXTRACTION — source text was sent to SERV after consent. Quotes and interpretations still need review.');
  const titleline = el('div', 'report-titleline');
  const heading = el('div');
  heading.append(el('h3', '', synthetic ? example.title : 'Source text review'),
    el('p', '', synthetic ? example.label : 'User-supplied URL; page not fetched'));
  titleline.append(heading, el('span', `report-pill ${synthetic ? '' : 'live'}`, synthetic ? 'INVENTED CASE' : 'LIVE EXTRACTION'));
  output.append(titleline);

  const reward = report.advertised_reward;
  const availability = report.award_availability;
  const isCash = reward.type === 'advertised_cash';
  const awardText = availability.status === 'no_awards_indicated' ? 'No awards indicated' :
    availability.status === 'advertised_awards_remain' ? 'Awards stated to remain' : 'Unknown';
  const grid = el('div', 'metric-grid');
  grid.append(
    metric('Advertised value', money(reward.amount, reward.unit), isCash ? 'Cash stated in source text' : cleanLabel(reward.type), isCash ? '' : 'warn'),
    metric('Award availability', awardText, availability.awards_remaining === null ? 'Remaining count unknown' : `${availability.awards_remaining} remaining in pasted text`, availability.status === 'no_awards_indicated' ? 'block' : availability.status === 'unknown' ? 'warn' : ''),
    metric('Payout timing', report.payout_timing.status === 'unknown' ? 'Unknown' : 'Text states timing', 'Fit to your horizon unverified', report.payout_timing.status === 'unknown' ? 'warn' : '')
  );
  output.append(grid);

  const assessment = section('What the supplied text supports');
  reportRow(assessment, 'Reward', `${cleanLabel(reward.type)}. Advertised value is not earned income.`);
  reportRow(assessment, 'Availability', `${cleanLabel(availability.status)}. An “open” badge cannot restore exhausted award capacity.`);
  reportRow(assessment, 'Entry costs', `${cleanLabel(report.budget.status)}. Other costs may be unknown.`);
  reportRow(assessment, 'Your horizon', `Desired within ${report.user_preferences.desired_payout_within_days} days; payout fit ${cleanLabel(report.payout_timing.horizon_fit)}.`);
  reportRow(assessment, 'Deadline', report.submission_deadline ?? 'Unknown');
  reportRow(assessment, 'Entry terms', report.entry_requirements ?? 'Unknown');

  const evidence = section(`Evidence in pasted text · ${report.citations.length} quotes`);
  const list = el('div', 'evidence-list');
  for (const citation of report.citations) {
    const card = el('div', 'evidence-card');
    const top = el('div', 'evidence-top');
    top.append(el('strong', '', citation.label), el('span', '', cleanLabel(citation.value)));
    card.append(top, el('blockquote', '', `“${citation.quote}”`));
    list.append(card);
  }
  evidence.append(list);

  const questions = section('Resolve before doing the work');
  const ul = el('ul', 'questions');
  for (const question of report.next_questions) ul.append(el('li', '', question));
  questions.append(ul);
  const fine = el('p', 'fine-print');
  fine.append(el('strong', '', 'Scope: '), document.createTextNode(report.interpretation_scope));
  output.append(fine);
  const provenance = el('p', 'fine-print');
  provenance.append(el('strong', '', 'Provenance: '), document.createTextNode(`${report.source_url} · SHA-256 ${report.input_sha256} · ${report.generated_at} · ${report.model}`));
  output.append(provenance);
}

async function postAnalysis(payload) {
  const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Analysis failed.');
  return data;
}

async function runExample(id) {
  if (!['exhausted', 'credit', 'judged'].includes(id)) return;
  invalidateReport('Opening synthetic example…');
  const requestId = requestGeneration;
  activeExample = id;
  for (const button of document.querySelectorAll('[data-example]')) button.classList.toggle('active', button.dataset.example === id);
  try {
    const data = await postAnalysis({ mode: 'example', exampleId: id, ...prefs() });
    if (requestId !== requestGeneration) return;
    sourceUrl.value = data.report.source_url;
    listingText.value = data.example.text;
    updateCount();
    renderReport(data.report, data.example);
  } catch (error) { if (requestId === requestGeneration) setNotice(error.message, true); }
}

for (const button of document.querySelectorAll('[data-example]')) button.addEventListener('click', () => runExample(button.dataset.example));
function userChangedInput() {
  invalidateReport();
  activeExample = null;
  for (const button of document.querySelectorAll('[data-example]')) button.classList.remove('active');
  updateCount();
}
for (const field of [sourceUrl, listingText, budget, horizon]) field.addEventListener('input', userChangedInput);
consent.addEventListener('change', userChangedInput);
$('analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!liveEnabled) return setNotice('Live SERV analysis needs a configured key. Use a synthetic example meanwhile.', true);
  invalidateReport('Sending one consented request to SERV…');
  const requestId = requestGeneration;
  liveButton.disabled = true;
  try {
    const data = await postAnalysis({ mode: 'live', sourceUrl: sourceUrl.value, sourceText: listingText.value, consent: consent.checked, ...prefs() });
    if (requestId !== requestGeneration) return;
    renderReport(data.report);
  } catch (error) { if (requestId === requestGeneration) setNotice(error.message, true); }
  finally { liveButton.disabled = !liveEnabled; }
});
downloadButton.addEventListener('click', () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `earncheck-${lastReport.mode}-${lastReport.input_sha256.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

fetch('/api/status').then(response => response.json()).then(status => {
  liveEnabled = status.live_enabled === true;
  liveButton.disabled = !liveEnabled;
  $('live-note').textContent = liveEnabled ? 'Live requests send only consented public or synthetic text to SERV. One request, no retries.' :
    'Live mode unavailable: no SERV key is configured. Synthetic examples work locally.';
}).catch(() => setNotice('Local status could not be read.', true));
updateCount();
runExample('exhausted');
