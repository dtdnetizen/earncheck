import seed from "../../data/seed-documents.json";

const docs = seed.documents as Record<string, any>[];
const byId = new Map(docs.map((doc) => [doc._id, doc]));
const deref = (ref: any) => ref?._ref ? byId.get(ref._ref) : undefined;

export function getDemoOffers() {
  return docs.filter((doc) => doc._type === "offer").map((offer) => ({
    _id: offer._id,
    title: offer.title,
    buyerAlias: offer.buyerAlias,
    status: offer.status,
    amount: offer.amount,
    scopeSummary: offer.scopeSummary,
    syntheticSample: offer.syntheticSample,
    deliveredEvidence: (offer.deliveryEvidence ?? []).map(deref).filter(Boolean).length > 0,
    evidence: (offer.deliveryEvidence ?? []).map(deref).filter(Boolean),
    buyerReview: deref((offer.buyerReviews ?? [])[0]),
    receipts: (offer.receipts ?? []).map(deref).filter(Boolean).map((receipt: any) => ({
      ...receipt,
      sourceEvidenceAvailable: Boolean(receipt.sourceEvidence?._ref),
    })),
  }));
}
