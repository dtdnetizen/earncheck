import test from "node:test";
import assert from "node:assert/strict";
import { classifyOffer, classifyReceipt } from "../src/domain/classify.mjs";

const baseOffer = {
  _id: "offer-synthetic-1",
  status: "accepted",
  amount: { value: 75, asset: "USD" },
  deliveredEvidence: true,
  buyerReview: { status: "approved", independent: true },
};

test("internal same-operator test never becomes earned customer income", () => {
  const receipt = { status: "verified", kind: "internal_test", independent: false, sourceEvidenceAvailable: true, amount: { value: 0.01, asset: "XNO" } };
  assert.equal(classifyReceipt(receipt).countedAsIncome, false);
  assert.equal(classifyOffer({ ...baseOffer, receipts: [receipt] }).stage, "sprout");
});

test("prepaid credit is not customer payment", () => {
  const receipt = { status: "verified", kind: "prepaid_credit", independent: true, sourceEvidenceAvailable: true, amount: { value: 10, asset: "USD" } };
  assert.equal(classifyReceipt(receipt).countedAsIncome, false);
  assert.equal(classifyOffer({ ...baseOffer, receipts: [receipt] }).stage, "sprout");
});

test("pending or non-independent review blocks bloom", () => {
  const receipt = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, amount: { value: 75, asset: "USD" } };
  assert.equal(classifyOffer({ ...baseOffer, buyerReview: { status: "pending", independent: false }, receipts: [receipt] }).stage, "sprout");
});

test("independently approved delivery plus verified matching customer receipt blooms", () => {
  const receipt = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, amount: { value: 75, asset: "USD" } };
  assert.equal(classifyOffer({ ...baseOffer, receipts: [receipt] }).stage, "bloom");
  assert.equal(classifyReceipt(receipt).countedAsIncome, true);
});

test("mismatched receipt asset or amount cannot bloom", () => {
  const amountMismatch = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, amount: { value: 7, asset: "USD" } };
  const assetMismatch = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, amount: { value: 75, asset: "USDC" } };
  assert.notEqual(classifyOffer({ ...baseOffer, receipts: [amountMismatch] }).stage, "bloom");
  assert.notEqual(classifyOffer({ ...baseOffer, receipts: [assetMismatch] }).stage, "bloom");
});

test("an unaccepted offer cannot bloom, even with receipt-looking data", () => {
  const receipt = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, amount: { value: 75, asset: "USD" } };
  assert.equal(classifyOffer({ ...baseOffer, status: "proposed", receipts: [receipt] }).stage, "seed");
});

test("synthetic flower scenario demonstrates gates but is never counted as real income", () => {
  const receipt = { status: "verified", kind: "customer_payment", independent: true, sourceEvidenceAvailable: true, syntheticSample: true, amount: { value: 75, asset: "USD" } };
  assert.equal(classifyReceipt(receipt).eligible, true);
  assert.equal(classifyReceipt(receipt).countedAsIncome, false);
  const result = classifyOffer({ ...baseOffer, receipts: [receipt], syntheticSample: true });
  assert.equal(result.stage, "bloom");
  assert.equal(result.synthetic, true);
});
