const normalizeAsset = (value) => String(value ?? "").trim().toUpperCase();

export function classifyReceipt(receipt = {}) {
  const reasons = [];
  if (receipt.kind !== "customer_payment") reasons.push("not an external customer payment");
  if (receipt.status !== "verified") reasons.push("receipt is not verified");
  if (receipt.independent !== true) reasons.push("no independent source confirmation");
  if (receipt.sourceEvidenceAvailable !== true) reasons.push("source evidence is missing");
  const eligible = reasons.length === 0;
  return {
    eligible,
    countedAsIncome: eligible && receipt.syntheticSample !== true,
    synthetic: receipt.syntheticSample === true,
    reasons,
  };
}

export function classifyOffer(offer = {}) {
  if (["declined", "expired"].includes(offer.status)) {
    return { stage: "wilt", reasons: ["offer closed without an active delivery"] };
  }
  if (offer.status !== "accepted") {
    return { stage: "seed", reasons: ["no accepted paid scope"] };
  }
  if (offer.deliveredEvidence !== true) {
    return { stage: "seed", reasons: ["delivery evidence is missing"] };
  }

  const approvedReview = offer.buyerReview?.status === "approved" && offer.buyerReview?.independent === true;
  const matchingReceipt = (offer.receipts ?? []).find((receipt) => {
    const result = classifyReceipt(receipt);
    return result.eligible && Number(receipt.amount?.value) === Number(offer.amount?.value)
      && normalizeAsset(receipt.amount?.asset) === normalizeAsset(offer.amount?.asset);
  });

  if (approvedReview && matchingReceipt) {
    return {
      stage: "bloom",
      reasons: matchingReceipt.syntheticSample === true
        ? ["synthetic scenario passes the receipt gates; not real income"]
        : ["independent approval and a verified matching customer receipt are linked"],
      synthetic: matchingReceipt.syntheticSample === true,
    };
  }

  const reasons = [];
  if (!approvedReview) reasons.push("independent buyer approval is missing");
  if (!matchingReceipt) reasons.push("verified matching customer receipt is missing");
  return { stage: "sprout", reasons };
}
