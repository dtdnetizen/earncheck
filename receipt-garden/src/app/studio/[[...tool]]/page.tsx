import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export const dynamic = "force-static";
export function generateStaticParams() { return [{ tool: [] }]; }
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  const ready = Boolean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID && process.env.NEXT_PUBLIC_SANITY_DATASET);
  if (!ready) {
    return <main className="setup-screen"><a href="/">← Receipt Garden</a><span className="eyebrow">STUDIO · SETUP REQUIRED</span><h1>The garden needs a project.</h1><p>Set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET in a local environment file, then restart the app. No project, account, token, or dataset is created by this demo.</p><p>After configuration, this route renders the embedded Sanity Studio and its four document types.</p></main>;
  }
  return <NextStudio config={config} />;
}
