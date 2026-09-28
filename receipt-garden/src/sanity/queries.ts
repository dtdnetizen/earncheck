export const GARDEN_QUERY = `*[_type == "offer"] | order(_createdAt desc) {
  _id, title, buyerAlias, status, amount, scopeSummary, acceptanceCriteria, syntheticSample,
  "deliveryEvidence": deliveryEvidence[]->{ _id, title, kind, sourceLabel, observedAt, sourceFingerprint, verificationNote, syntheticSample },
  "buyerReviews": buyerReviews[]->{ _id, status, reviewerAlias, independent, reviewedAt, rationale, syntheticSample },
  "receipts": receipts[]->{ _id, kind, status, independent, amount, verifiedAt, syntheticSample, "sourceEvidenceAvailable": defined(sourceEvidence._ref) }
}`;
