import { Garden } from "@/components/Garden";
import { loadGarden } from "@/sanity/data";

export const dynamic = "force-static";

export default async function Home() {
  const data = await loadGarden();
  if (data.mode !== "sanity-public" || data.offers.length === 0) {
    throw new Error("Static deployment requires readable published Sanity offers at build time.");
  }
  return <Garden mode={data.mode} offers={data.offers} note={data.note} />;
}
