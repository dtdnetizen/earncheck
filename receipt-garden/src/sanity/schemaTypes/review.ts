import { defineField, defineType } from "sanity";

export const review = defineType({
  name: "review",
  title: "Independent review",
  type: "document",
  fields: [
    defineField({ name: "offer", type: "reference", to: [{ type: "offer" }], validation: (rule) => rule.required() }),
    defineField({ name: "status", type: "string", options: { list: ["pending", "approved", "declined"] }, validation: (rule) => rule.required() }),
    defineField({ name: "reviewerAlias", type: "string" }),
    defineField({ name: "independent", title: "Reviewer is independent of the operator", type: "boolean", initialValue: false }),
    defineField({ name: "reviewedAt", type: "datetime" }),
    defineField({ name: "evidence", type: "array", of: [{ type: "reference", to: [{ type: "evidence" }] }] }),
    defineField({ name: "rationale", type: "text", rows: 3 }),
    defineField({ name: "syntheticSample", type: "boolean", initialValue: false, validation: (rule) => rule.required() }),
    defineField({ name: "provenance", type: "object", fields: [
      defineField({ name: "sourceKind", type: "string", options: { list: ["fixture", "public", "operator"] } }),
      defineField({ name: "sourceHash", type: "string" }),
      defineField({ name: "agentAssisted", type: "boolean" }),
    ] }),
  ],
  preview: { select: { title: "reviewerAlias", subtitle: "status" } },
});
