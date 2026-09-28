import { defineField, defineType } from "sanity";

export const offer = defineType({
  name: "offer",
  title: "Offer seed",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "buyerAlias", title: "Buyer alias (pseudonymous)", type: "string" }),
    defineField({ name: "status", type: "string", options: { list: ["proposed", "accepted", "declined", "expired"] }, validation: (rule) => rule.required() }),
    defineField({ name: "amount", type: "object", fields: [
      defineField({ name: "value", type: "number", validation: (rule) => rule.required().positive() }),
      defineField({ name: "asset", title: "Native currency / asset", type: "string", validation: (rule) => rule.required() }),
    ] }),
    defineField({ name: "scopeSummary", type: "text", rows: 3 }),
    defineField({ name: "acceptanceCriteria", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "deliveryEvidence", type: "array", of: [{ type: "reference", to: [{ type: "evidence" }] }] }),
    defineField({ name: "buyerReviews", type: "array", of: [{ type: "reference", to: [{ type: "review" }] }] }),
    defineField({ name: "receipts", type: "array", of: [{ type: "reference", to: [{ type: "receipt" }] }] }),
    defineField({ name: "syntheticSample", type: "boolean", initialValue: false, validation: (rule) => rule.required() }),
    defineField({ name: "provenance", type: "object", fields: [
      defineField({ name: "sourceKind", type: "string", options: { list: ["fixture", "public", "operator"] } }),
      defineField({ name: "note", type: "text" }),
    ] }),
  ],
  preview: { select: { title: "title", subtitle: "status" } },
});
