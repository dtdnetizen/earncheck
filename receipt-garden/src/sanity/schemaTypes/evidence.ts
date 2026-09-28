import { defineField, defineType } from "sanity";

export const evidence = defineType({
  name: "evidence",
  title: "Evidence leaf",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "offer", type: "reference", to: [{ type: "offer" }] }),
    defineField({ name: "kind", type: "string", options: { list: ["offer", "delivery", "review", "receipt", "test"] }, validation: (rule) => rule.required() }),
    defineField({ name: "sourceLabel", type: "string" }),
    defineField({ name: "sourceUrl", type: "url" }),
    defineField({ name: "observedAt", type: "datetime" }),
    defineField({ name: "sourceFingerprint", title: "Reproducible source fingerprint", type: "string" }),
    defineField({ name: "verificationNote", type: "text", rows: 3 }),
    defineField({ name: "syntheticSample", type: "boolean", initialValue: false, validation: (rule) => rule.required() }),
    defineField({ name: "provenance", type: "object", fields: [
      defineField({ name: "sourceKind", type: "string", options: { list: ["fixture", "public", "operator"] } }),
      defineField({ name: "sourceUrl", type: "url" }),
      defineField({ name: "sourceHash", type: "string" }),
      defineField({ name: "agentAssisted", type: "boolean" }),
    ] }),
  ],
  preview: { select: { title: "title", subtitle: "kind" } },
});
