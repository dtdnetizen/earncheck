import { getPublicSanityClient } from "./client";
import { GARDEN_QUERY } from "./queries";
import { getDemoOffers } from "./demo";

export type GardenOffer = {
  _id: string;
  title: string;
  buyerAlias?: string;
  status: string;
  amount?: { value: number; asset: string };
  scopeSummary?: string;
  syntheticSample?: boolean;
  deliveredEvidence: boolean;
  evidence: Array<{ title: string; kind: string; sourceLabel?: string; observedAt?: string; sourceFingerprint?: string; verificationNote?: string; syntheticSample?: boolean }>;
  buyerReview?: { status: string; reviewerAlias?: string; independent?: boolean; rationale?: string; syntheticSample?: boolean };
  receipts: Array<{ kind: string; status: string; independent?: boolean; amount?: { value: number; asset: string }; sourceEvidenceAvailable: boolean; syntheticSample?: boolean; verifiedAt?: string }>;
};

export async function loadGarden(): Promise<{ mode: "local-demo" | "sanity-public" | "sanity-error"; offers: GardenOffer[]; note?: string }> {
  const client = getPublicSanityClient();
  if (!client) return { mode: "local-demo", offers: getDemoOffers() as GardenOffer[] };
  try {
    const raw = await client.fetch<any[]>(GARDEN_QUERY, {}, { cache: "force-cache" });
    const offers = raw.map((offer) => ({
      ...offer,
      deliveredEvidence: Boolean(offer.deliveryEvidence?.length),
      evidence: offer.deliveryEvidence ?? [],
      buyerReview: offer.buyerReviews?.[0],
      receipts: (offer.receipts ?? []).map((receipt: any) => ({
        ...receipt,
        sourceEvidenceAvailable: Boolean(receipt.sourceEvidenceAvailable),
      })),
    }));
    return { mode: "sanity-public", offers };
  } catch {
    return { mode: "sanity-error", offers: [], note: "Public dataset read failed. Check project ID, public read access, dataset name and network." };
  }
}
