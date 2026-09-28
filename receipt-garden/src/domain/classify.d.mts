export type ReceiptLike = {
  kind?: string;
  status?: string;
  independent?: boolean;
  sourceEvidenceAvailable?: boolean;
  syntheticSample?: boolean;
  amount?: { value?: number; asset?: string };
};
export type OfferLike = {
  status?: string;
  amount?: { value?: number; asset?: string };
  deliveredEvidence?: boolean;
  buyerReview?: { status?: string; independent?: boolean };
  receipts?: ReceiptLike[];
};
export function classifyReceipt(receipt?: ReceiptLike): {
  eligible: boolean;
  countedAsIncome: boolean;
  synthetic: boolean;
  reasons: string[];
};
export function classifyOffer(offer?: OfferLike): {
  stage: "seed" | "sprout" | "bloom" | "wilt";
  reasons: string[];
  synthetic?: boolean;
};
