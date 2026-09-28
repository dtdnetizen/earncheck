import { defineField, defineType } from "sanity";

export const receipt = defineType({
  name: "receipt",
  title: "Receipt seed",
  type: "document",
  fields: [
    defineField({ name: "offer", type: "reference", to: [{ type: "offer" }], validation: (rule) => rule.required() }),
    defineField({ name: "kind", title: "Economic meaning", type: "string", options: { list: ["customer_payment", "internal_test", "prepaid_credit", "platform_award", "transfer"] }, validation: (rule) => rule.required() }),
    defineField({ name: "status", type: "string", options: { list: ["unverified", "verified", "reversed"] }, validation: (rule) => rule.required() }),
    defineField({ name: "independent", title: "Independently sourced", type: "boolean", initialValue: false }),
    defineField({ name: "amount", type: "object", fields: [
      defineField({ name: "value", type: "number", validation: (rule) => rule.required().positive() }),
      defineField({ name: "asset", title: "Native currency / asset and network", type: "string", validation: (rule) => rule.required() }),
    ] }),
    defineField({ name: "sourceEvidence", type: "reference", to: [{ type: "evidence" }], validation: (rule) => rule.required() }),
    defineField({ name: "verifiedAt", type: "datetime" }),
    defineField({ name: "syntheticSample", type: "boolean", initialValue: false, validation: (rule) => rule.required() }),
    defineField({ name: "provenance", type: "object", fields: [
      defineField({ name: "sourceKind", type: "string", options: { list: ["fixture", "public", "operator"] } }),
      defineField({ name: "sourceHash", type: "string" }),
      defineField({ name: "note", type: "text" }),
    ] }),
  ],
  preview: { select: { title: "offer->title", subtitle: "kind" } },
});
