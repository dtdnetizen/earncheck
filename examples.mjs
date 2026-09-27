export const EXAMPLES = Object.freeze({
  exhausted: {
    id: 'exhausted',
    title: 'Open badge, no awards left',
    label: 'SYNTHETIC EXAMPLE — invented for this demo',
    sourceUrl: 'https://synthetic.example/exhausted-awards',
    text: 'Status: Open for submissions. Reward: $80 USD cash per accepted entry. Award capacity: 3. Awards remaining: 0. Deadline: 30 September 2026. No entry fee. Winners are chosen by a judge. Payment timing is not stated.',
    extraction: {
      reward_type: { value: 'cash', quote: '$80 USD cash per accepted entry' },
      reward_amount: { value: 80, quote: '$80 USD cash per accepted entry' },
      reward_unit: { value: 'USD', quote: '$80 USD cash per accepted entry' },
      listing_status: { value: 'open', quote: 'Status: Open for submissions' },
      award_capacity: { value: 3, quote: 'Award capacity: 3' },
      awards_remaining: { value: 0, quote: 'Awards remaining: 0' },
      deadline: { value: '30 September 2026', quote: 'Deadline: 30 September 2026' },
      payout_timing: { value: null, quote: null },
      entry_fee: { value: 'none', quote: 'No entry fee' },
      entry_fee_amount: { value: null, quote: null },
      entry_fee_unit: { value: null, quote: null },
      entry_requirements: { value: 'Winners are chosen by a judge', quote: 'Winners are chosen by a judge' }
    }
  },
  credit: {
    id: 'credit',
    title: 'API credit, not cash',
    label: 'SYNTHETIC EXAMPLE — invented for this demo',
    sourceUrl: 'https://synthetic.example/api-credit',
    text: 'Status: Open. Reward: $25 in API credits. Credits cannot be withdrawn or converted to cash. Award capacity: 100. Awards remaining: 18. Deadline: 15 October 2026. No entry fee. Applicants must publish a demo link. Credits arrive within 7 days of approval.',
    extraction: {
      reward_type: { value: 'credit', quote: '$25 in API credits' },
      reward_amount: { value: 25, quote: '$25 in API credits' },
      reward_unit: { value: '$', quote: '$25 in API credits' },
      listing_status: { value: 'open', quote: 'Status: Open' },
      award_capacity: { value: 100, quote: 'Award capacity: 100' },
      awards_remaining: { value: 18, quote: 'Awards remaining: 18' },
      deadline: { value: '15 October 2026', quote: 'Deadline: 15 October 2026' },
      payout_timing: { value: 'Credits arrive within 7 days of approval', quote: 'Credits arrive within 7 days of approval' },
      entry_fee: { value: 'none', quote: 'No entry fee' },
      entry_fee_amount: { value: null, quote: null },
      entry_fee_unit: { value: null, quote: null },
      entry_requirements: { value: 'Applicants must publish a demo link', quote: 'Applicants must publish a demo link' }
    }
  },
  judged: {
    id: 'judged',
    title: 'Judged cash bounty, timing unknown',
    label: 'SYNTHETIC EXAMPLE — invented for this demo',
    sourceUrl: 'https://synthetic.example/judged-bounty',
    text: 'Status: Open. Prize: $150 USD cash for one winning entry. Award capacity: 1. Awards remaining: 1. Deadline: 20 October 2026. No entry fee. Submit an original 600-word research note; a judge selects the winner. Payout timing will be announced later.',
    extraction: {
      reward_type: { value: 'cash', quote: '$150 USD cash for one winning entry' },
      reward_amount: { value: 150, quote: '$150 USD cash for one winning entry' },
      reward_unit: { value: 'USD', quote: '$150 USD cash for one winning entry' },
      listing_status: { value: 'open', quote: 'Status: Open' },
      award_capacity: { value: 1, quote: 'Award capacity: 1' },
      awards_remaining: { value: 1, quote: 'Awards remaining: 1' },
      deadline: { value: '20 October 2026', quote: 'Deadline: 20 October 2026' },
      payout_timing: { value: null, quote: null },
      entry_fee: { value: 'none', quote: 'No entry fee' },
      entry_fee_amount: { value: null, quote: null },
      entry_fee_unit: { value: null, quote: null },
      entry_requirements: { value: 'Submit an original 600-word research note; a judge selects the winner', quote: 'Submit an original 600-word research note; a judge selects the winner' }
    }
  }
});
