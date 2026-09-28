// Offer Proof Gate: deterministic checks over caller-supplied public text.
// This does not fetch the URL or establish that a buyer can or will pay.
const fields = new Set(['reward', 'status', 'awards_remaining', 'entry_fee', 'deadline']);
const units = 'USDC|USD|XNO|NANO|credits?|points?';
const number = '(\\d{1,9}(?:\\.\\d{1,6})?)';

function parseReward(quote) {
  const match = quote.match(new RegExp(`^Reward:\\s*${number}\\s+(${units})\\.?$`, 'i'));
  return match ? { amount: Number(match[1]), unit: match[2].toUpperCase().replace(/S$/, '') } : null;
}

function parseRemaining(quote) {
  const match = quote.match(/^(\d{1,9}) awards? remaining\.?$/i);
  return match ? Number(match[1]) : null;
}

function parseStatus(quote) {
  const match = quote.match(/^Status:\s*(Open|Closed)\.?$/i);
  return match ? match[1].toLowerCase() : null;
}

function parseFee(quote) {
  if (/^No entry fee\.?$/i.test(quote)) return 'none';
  const match = quote.match(/^Entry fee:\s*\$?\s*(\d{1,9}(?:\.\d{1,6})?)\s*(?:USD|USDC|XNO|NANO)?\.?$/i);
  if (match) return Number(match[1]) > 0 ? 'required' : 'none';
  return null;
}

function validIsoUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().replace('.000Z', 'Z') === value;
}

function parseDeadline(quote) {
  const match = quote.match(/^Deadline:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\.?$/i);
  return match && validIsoUtc(match[1]) ? match[1] : null;
}

function same(a, b) {
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return a.amount === b.amount && a.unit === b.unit;
  return a === b;
}

function conflictsElsewhere(text, field, observed) {
  let values = [];
  if (field === 'status') values = [...text.matchAll(/\bStatus:\s*(Open|Closed)\b/gi)].map(m => m[1].toLowerCase());
  if (field === 'awards_remaining') values = [...text.matchAll(/\b(\d{1,9}) awards? remaining\b/gi)].map(m => Number(m[1]));
  if (field === 'reward') values = [...text.matchAll(new RegExp(`\\bReward:\\s*${number}\\s+(${units})\\b`, 'gi'))]
    .map(m => ({ amount: Number(m[1]), unit: m[2].toUpperCase().replace(/S$/, '') }));
  if (field === 'deadline') values = [...text.matchAll(/\bDeadline:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\b/gi)].map(m => m[1]);
  if (field === 'entry_fee') {
    if (/\bNo entry fee\b/i.test(text)) values.push('none');
    for (const match of text.matchAll(/\bEntry fee:\s*\$?\s*(\d{1,9}(?:\.\d{1,6})?)\b/gi))
      values.push(Number(match[1]) > 0 ? 'required' : 'none');
  }
  return values.some(value => !same(value, observed));
}

function isWholeClause(text, quote) {
  let at = text.indexOf(quote);
  while (at !== -1) {
    const before = text.slice(0, at);
    const after = text.slice(at + quote.length);
    const left = at === 0 || /(?:\n|\. )$/.test(before);
    const right = !after || /^(?:\.|\n|\r\n)/.test(after) || (quote.endsWith('.') && /^\s/.test(after));
    if (left && right) return true;
    at = text.indexOf(quote, at + 1);
  }
  return false;
}

export function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_input');
  const { source_url: sourceUrl, source_text: sourceText, claims } = input;
  let url;
  try { url = new URL(sourceUrl); } catch { throw new Error('invalid_url'); }
  if (url.protocol !== 'https:' || url.username || url.password || sourceUrl.length > 500) throw new Error('invalid_url');
  if (typeof sourceText !== 'string' || !sourceText.trim() || sourceText.length > 12000) throw new Error('invalid_source_text');
  if (!Array.isArray(claims) || claims.length < 1 || claims.length > 5) throw new Error('invalid_claims');
  const seen = new Set();
  for (const claim of claims) {
    if (!claim || typeof claim !== 'object' || Array.isArray(claim) ||
        JSON.stringify(Object.keys(claim).sort()) !== JSON.stringify(['field', 'quote', 'value'])) throw new Error('invalid_claim');
    if (!fields.has(claim.field) || seen.has(claim.field)) throw new Error('invalid_claim_field');
    seen.add(claim.field);
    if (typeof claim.quote !== 'string' || !claim.quote.length || claim.quote.length > 500) throw new Error('invalid_quote');
    if (claim.field === 'reward' && (!claim.value || typeof claim.value !== 'object' ||
        !Number.isFinite(claim.value.amount) || claim.value.amount < 0 || !['USDC','USD','XNO','NANO','CREDIT','POINT'].includes(claim.value.unit))) throw new Error('invalid_reward');
    if (claim.field === 'awards_remaining' && (!Number.isInteger(claim.value) || claim.value < 0)) throw new Error('invalid_remaining');
    if (claim.field === 'status' && !['open','closed'].includes(claim.value)) throw new Error('invalid_status');
    if (claim.field === 'entry_fee' && !['none','required'].includes(claim.value)) throw new Error('invalid_fee');
    if (claim.field === 'deadline' && !validIsoUtc(claim.value)) throw new Error('invalid_deadline');
  }
  return { sourceUrl, sourceText, claims };
}

export async function checkOffer(input, now = () => new Date()) {
  const { sourceUrl, sourceText, claims } = validateInput(input);
  const checkedAt = now();
  const bytes = new TextEncoder().encode(`${sourceUrl}\n${sourceText}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sourceSha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  const parsers = { reward: parseReward, status: parseStatus, awards_remaining: parseRemaining,
    entry_fee: parseFee, deadline: parseDeadline };
  const checks = claims.map(({ field, value, quote }) => {
    if (!isWholeClause(sourceText, quote)) return { field, verdict: 'uncheckable', reason: 'quote_absent_or_not_whole_clause' };
    const parsed = parsers[field](quote);
    if (parsed === null) return { field, verdict: 'uncheckable', reason: 'evidence_ambiguous_or_missing' };
    if (conflictsElsewhere(sourceText, field, parsed))
      return { field, verdict: 'uncheckable', reason: 'conflicting_labeled_values_in_supplied_text' };
    return { field, verdict: same(value, parsed) ? 'quote_matches' : 'quote_conflicts',
      reason: same(value, parsed) ? 'claim_matches_quote' : 'claim_conflicts_with_quote',
      claimed: value, observed: parsed, quote };
  });
  const byField = Object.fromEntries(checks.map(c => [c.field, c]));
  // Use the parsed quote even when it contradicts the caller's claim.
  const status = byField.status?.observed ?? null;
  const remaining = byField.awards_remaining?.observed ?? null;
  const deadline = byField.deadline?.observed ?? null;
  const availability = remaining === 0 || status === 'closed' ? 'no_awards_indicated_by_selected_quotes' :
    deadline !== null && Date.parse(deadline) <= checkedAt.getTime() ? 'selected_deadline_elapsed' :
    status === 'open' && remaining > 0 && deadline !== null ? 'selected_quotes_indicate_open_before_deadline' : 'unknown';
  const verdict = checks.some(c => c.verdict === 'quote_conflicts') ? 'quote_conflicts' :
    checks.every(c => c.verdict === 'quote_matches') ? 'quote_matches' : 'uncheckable';
  return { schema_version: '1.0', checked_at_utc: checkedAt.toISOString(), source_url: sourceUrl,
    source_url_status: 'caller_supplied_not_fetched', source_sha256: sourceSha256, verdict,
    availability_from_selected_quotes: availability, checks,
    scope: 'Labeled quotes are checked against caller-supplied text only. Matching quotes do not prove a real/current offer. No live source, solvency, acceptance, payout, or AI eligibility verification.' };
}
