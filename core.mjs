import { createHash } from 'node:crypto';

const FIELDS = Object.freeze({
  reward_type: 'enum:cash,token,credit,noncash',
  reward_amount: 'number',
  reward_unit: 'string',
  listing_status: 'enum:open,closed',
  award_capacity: 'integer',
  awards_remaining: 'integer',
  deadline: 'string',
  payout_timing: 'string',
  entry_fee: 'enum:none,required',
  entry_fee_amount: 'number',
  entry_fee_unit: 'string',
  entry_requirements: 'string'
});

export function extractionResponseFormat() {
  const properties = {};
  for (const [field, kind] of Object.entries(FIELDS)) {
    const value = kind.startsWith('enum:')
      ? { type: ['string', 'null'], enum: [...kind.slice(5).split(','), null] }
      : { type: [kind, 'null'] };
    properties[field] = { type: 'object', additionalProperties: false,
      properties: { value, quote: { type: ['string', 'null'] } }, required: ['value', 'quote'] };
  }
  return { type: 'json_schema', json_schema: { name: 'earncheck_extraction', strict: true,
    schema: { type: 'object', additionalProperties: false, properties,
      required: Object.keys(FIELDS) } } };
}

export function extractionShapeDiagnostic(candidate) {
  const topLevelType = candidate === null ? 'null' : Array.isArray(candidate) ? 'array' : typeof candidate;
  const keys = topLevelType === 'object' ? Object.keys(candidate) : [];
  const expected = Object.keys(FIELDS);
  return { top_level_type: topLevelType,
    missing_expected_fields: expected.filter(field => !Object.hasOwn(candidate ?? {}, field)),
    unexpected_key_count: keys.filter(field => !Object.hasOwn(FIELDS, field)).length };
}

export const FIELD_LABELS = Object.freeze({
  reward_type: 'Reward type', reward_amount: 'Advertised amount', reward_unit: 'Reward unit',
  listing_status: 'Listing status', award_capacity: 'Award capacity', awards_remaining: 'Awards remaining',
  deadline: 'Submission deadline', payout_timing: 'Payout timing', entry_fee: 'Entry fee',
  entry_fee_amount: 'Entry fee amount', entry_fee_unit: 'Entry fee unit', entry_requirements: 'Entry requirements'
});

export function validateExtraction(candidate, sourceText) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(Object.keys(FIELDS).sort())) {
    throw new Error('Extraction fields do not match the allowed schema');
  }
  if (typeof sourceText !== 'string' || sourceText.length > 12000) throw new Error('Invalid source text');
  const output = {};
  for (const [field, kind] of Object.entries(FIELDS)) {
    const item = candidate[field];
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(['quote', 'value'])) {
      throw new Error(`Invalid ${field} structure`);
    }
    const { value, quote } = item;
    if (value === null) {
      if (quote !== null) throw new Error(`Unknown ${field} must have no quote`);
      output[field] = { value: null, quote: null };
      continue;
    }
    if (typeof quote !== 'string' || !quote.length || quote.length > 500 || !sourceText.includes(quote)) {
      throw new Error(`Unsupported quote for ${field}`);
    }
    if (kind.startsWith('enum:')) {
      if (typeof value !== 'string' || !kind.slice(5).split(',').includes(value)) throw new Error(`Invalid ${field} value`);
    } else if (kind === 'number' || kind === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000 ||
          (kind === 'integer' && !Number.isInteger(value))) throw new Error(`Invalid ${field} number`);
      const numbers = [...quote.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(match => Number(match[0].replaceAll(',', '')));
      if (!numbers.includes(value)) throw new Error(`Number absent from ${field} quote`);
      if (new Set(numbers).size !== 1) throw new Error(`Ambiguous mixed numbers in ${field} quote`);
    } else if (kind === 'string') {
      if (typeof value !== 'string' || !value.length || value.length > 300 || !quote.includes(value)) {
        throw new Error(`Invalid ${field} text`);
      }
    }
    if (field === 'reward_type' && value === 'cash' &&
        (!/\bcash\b/i.test(quote) ||
         /\bcredit(s)?\b|\bUSDC\b|\btoken(s)?\b|non.?withdrawable|not withdrawable|\b(no|not|without|instead of)\s+(?:\w+\s+){0,2}cash\b|\bno\s+monetary\s+reward\b/i.test(quote))) {
      throw new Error('Cash type lacks affirmative cash support');
    }
    if (field === 'reward_type' && value === 'credit' && !/\bcredit(s)?\b/i.test(quote)) {
      throw new Error('Credit type lacks a credit quote');
    }
    if (field === 'entry_fee' && value === 'none' &&
        (!/\b(no\s+(?:entry|submission|application)?\s*fee|free\s+(?:to\s+enter|entry|submission|application)|zero\s+(?:entry\s+)?fee|0\s+(?:USD\s+)?(?:entry\s+)?fee|entry\s+fee\s*[:=]\s*(?:0|zero)\b)/i.test(quote) ||
         /\b(not|isn't|is not)\s+free\b/i.test(quote))) {
      throw new Error('Free entry requires an explicit quote');
    }
    if (field === 'entry_fee' && value === 'required' && !/\b(fee|deposit|cost to enter|pay to enter)\b/i.test(quote)) {
      throw new Error('Required fee lacks an explicit quote');
    }
    if (field === 'reward_amount' &&
        (!/\b(reward|prize|bounty|cash|paid|winner|award|credits?|tokens?)\b/i.test(quote) ||
         /\b(entry fee|submission fee|application fee|deposit|cost to enter)\b/i.test(quote))) {
      throw new Error('Reward amount quote mixes or lacks reward context');
    }
    if (field === 'entry_fee_amount' &&
        (!/\b(fee|deposit|cost to enter|pay to enter)\b/i.test(quote) ||
         /\b(reward|prize|bounty|cash award)\b/i.test(quote))) {
      throw new Error('Entry fee amount quote mixes or lacks fee context');
    }
    if (field === 'award_capacity' && !/\b(capacity|total awards|award slots|winner slots)\b/i.test(quote)) {
      throw new Error('Award capacity lacks explicit context');
    }
    if (field === 'awards_remaining' && !/\b(remaining|left|available|unclaimed)\b/i.test(quote)) {
      throw new Error('Remaining awards lack explicit context');
    }
    if (field === 'payout_timing' && /\b(announced later|to be announced|not stated|unknown|tbd|to be determined|unspecified)\b/i.test(quote)) {
      throw new Error('Unspecified payout timing must stay unknown');
    }
    if (field === 'listing_status' &&
        ((value === 'open' && (!/\bopen\b/i.test(quote) || /\bclosed\b|\b(not|no longer|isn't|is not)\s+open\b/i.test(quote))) ||
         (value === 'closed' && (!/\bclosed\b/i.test(quote) || /\bopen\b|\b(not|no longer|isn't|is not)\s+closed\b/i.test(quote))))) {
      throw new Error('Listing status quote is contradictory or lacks explicit status');
    }
    output[field] = { value, quote };
  }
  if (output.award_capacity.value !== null && output.awards_remaining.value !== null &&
      output.awards_remaining.value > output.award_capacity.value) {
    throw new Error('Awards remaining exceed award capacity');
  }
  if (output.entry_fee.value === 'none' && output.entry_fee_amount.value !== null && output.entry_fee_amount.value > 0) {
    throw new Error('No-fee claim conflicts with a positive fee amount');
  }
  return output;
}

export function buildReport({ extraction, sourceText, sourceUrl, budget, horizonDays, mode, model }) {
  const facts = validateExtraction(extraction, sourceText);
  const value = field => facts[field].value;
  const reward = value('reward_type');
  const amount = value('reward_amount');
  const unit = value('reward_unit');
  const remaining = value('awards_remaining');
  const status = value('listing_status');
  const available = remaining === 0 || status === 'closed' ? 'no_awards_indicated' :
    remaining !== null && remaining > 0 && status === 'open' ? 'advertised_awards_remain' : 'unknown';
  const cash = reward === 'cash' ? 'advertised_cash' :
    reward === 'credit' ? 'credit_not_cash' : reward === 'token' ? 'token_not_cash' :
      reward === 'noncash' ? 'noncash' : 'unknown';
  const fee = value('entry_fee');
  const feeAmount = value('entry_fee_amount');
  const feeUnit = value('entry_fee_unit');
  const budgetFit = feeAmount !== null && feeUnit === 'USD' && feeAmount > budget ? 'known_usd_fee_exceeds_budget' :
    fee === 'none' ? 'no_entry_fee_stated' : 'unknown_other_costs';
  const timing = value('payout_timing') === null ? 'unknown' : 'stated_in_supplied_text_only';
  const questions = [];
  if (reward === null) questions.push('What can the award actually be withdrawn as?');
  if (remaining === null) questions.push('How many awards remain available now?');
  if (status === null) questions.push('Is the listing still accepting entries?');
  if (fee === null || (fee === 'required' && feeAmount === null)) questions.push('What are the exact entry fees and other costs?');
  if (timing === 'unknown') questions.push('When would an accepted winner actually be paid?');
  questions.push('What decides a winning entry, and is AI-assisted work allowed?');
  questions.push('Does the buyer confirm the current terms and payout method?');
  const citations = Object.entries(facts).filter(([, fact]) => fact.quote !== null)
    .map(([field, fact]) => ({ field, label: FIELD_LABELS[field], value: fact.value, quote: fact.quote,
      scope: 'exact substring of user-supplied text; interpretation and truth unverified' }));
  const inputHash = createHash('sha256').update(`${sourceUrl}\n${sourceText}`).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    mode,
    model: mode === 'live_serv' ? model : 'none — synthetic example, no SERV call',
    source_url: sourceUrl,
    source_url_status: 'user supplied; not fetched or authenticated',
    input_sha256: inputHash,
    user_preferences: { max_entry_spend: budget, desired_payout_within_days: horizonDays },
    interpretation_scope: 'Only supplied text was inspected. Exact quotes establish presence, not truth, completeness, current validity, or correct interpretation.',
    advertised_reward: { type: cash, amount, unit, caveat: 'Advertised value is not earnings or an expected payout.' },
    award_availability: { status: available, awards_remaining: remaining, listing_status: status },
    budget: { status: budgetFit, disclosed_entry_fee_amount: feeAmount, disclosed_entry_fee_unit: feeUnit,
      caveat: 'Unknown costs can still exist; a quoted no-fee statement is not independent verification.' },
    payout_timing: { status: timing, quoted_text: value('payout_timing'), horizon_fit: 'not_verified' },
    submission_deadline: value('deadline'),
    entry_requirements: value('entry_requirements'),
    citations,
    next_questions: questions
  };
}

export function modelInstruction() {
  const types = Object.entries(FIELDS).map(([name, kind]) => `${name}: ${kind}`).join('; ');
  return `Extract only from the supplied listing text. Return a JSON object with EXACTLY these 12 keys and types: ${types}. For EVERY key, return exactly {"value":...,"quote":...}; value must be a JSON number for number/integer fields, never a numeric string. Integers have no decimal part. Enum values are exactly one of their listed words. String values must be exact substrings of their quotes. Each non-null quote must be a short, exact, contiguous substring of the supplied text and include enough local context to identify that field. For absent, ambiguous, negated, contradicted, or merely implied facts use {"value":null,"quote":null}; never return a non-null value with a null quote. Never infer truth, current availability, or missing payment timing. reward_type cash needs affirmative cash wording, not merely a dollar sign. entry_fee none needs an explicit no-entry-fee statement; a no-refund sentence does not count. Numeric quotes must contain exactly one relevant number, with explicit field context; do not combine reward and fee amounts or include dates in amount quotes. reward_unit and entry_fee_unit are exact unit strings such as USD or JPY. For payout_timing, "to be announced", "not stated", and similar phrases mean null. Do not include markdown, prose, or extra keys.`;
}
