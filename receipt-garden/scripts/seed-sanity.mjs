import { readFile } from "node:fs/promises";
import { createClient } from "@sanity/client";

const apply = process.argv.includes("--apply");
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;
const fixture = JSON.parse(await readFile(new URL("../data/seed-documents.json", import.meta.url), "utf8"));

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", documents: fixture.documents.length, ids: fixture.documents.map((doc) => doc._id), mutation: false }, null, 2));
  process.exit(0);
}
if (!projectId || !dataset || !token) {
  console.error("Seed refused: set a real project ID, dataset and server-only SANITY_WRITE_TOKEN, then explicitly pass --apply.");
  process.exit(2);
}
if (fixture.documents.some((doc) => !doc._id.startsWith("rg-"))) {
  console.error("Seed refused: fixture includes an ID outside the receipt-garden namespace.");
  process.exit(2);
}
const client = createClient({ projectId, dataset, token, apiVersion: "2026-09-28", useCdn: false });
const tx = client.transaction();
for (const document of fixture.documents) tx.createOrReplace(document);
const result = await tx.commit();
console.log(JSON.stringify({ mode: "applied", projectId, dataset, documents: fixture.documents.length, transactionId: result.transactionId }, null, 2));
