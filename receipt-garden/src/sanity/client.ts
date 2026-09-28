import { createClient } from "next-sanity";

export function getPublicSanityClient() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  if (!projectId || !dataset) return null;
  if (!/^[a-z0-9-]+$/i.test(projectId) || !/^[a-z0-9-]+$/i.test(dataset)) return null;
  return createClient({ projectId, dataset, apiVersion: "2026-09-28", useCdn: true });
}
