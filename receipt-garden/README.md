# Receipt Garden

Receipt Garden is a Next.js and Sanity demonstration of evidence-aware earning claims. It keeps an offer, delivery evidence, independent review, and a customer receipt as separate records. The included twelve documents and every displayed offer, reviewer, and receipt are synthetic. The sample flower is not real income.

## Run and build

Use Node.js 22 or 24 and npm. Set the two **public** identifiers from a published, publicly readable Sanity dataset you control:

```powershell
Copy-Item .env.example .env.local
# Fill in NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET in .env.local.
npm ci
npm test
npm run build
```

The production build exports a static site to `out/` for Cloudflare Pages Direct Upload. It refuses to build if the configured dataset cannot be read or contains no published offers. No server process or Sanity write token is needed to serve the exported files.

**Content updates:** The public page is a snapshot of Sanity content fetched at build time. Editing Sanity records does not update a deployed page until it is rebuilt and uploaded again. The classification logic runs over that snapshot in the browser.

The `/studio/` path contains a static embedded Studio shell. The Sanity project used for the initial build was unclaimed at publication preparation time. Its owner must claim it before expiry, sign in, and add the site's exact origin to Sanity CORS with credentials before attempting edits. Studio sign-in, editing, and deep-route reloads have not been verified on a deployed site.

## Synthetic fixture and checks

`npm run seed:dry-run` lists twelve synthetic documents without writing. `node scripts/seed-sanity.mjs --apply` is an optional real write to a project you control; it requires a server-only `SANITY_WRITE_TOKEN` in the process environment and touches only fixture IDs beginning `rg-`. Never expose that token in browser code or commit it.

`npm test` covers the receipt classification gates: internal transfers, prepaid credit, independent approval, matching native asset and amount, accepted scope, and synthetic income exclusion. `npm run typecheck` checks TypeScript after dependencies are installed.

This source is licensed under MIT. Sanity, Next.js, and other dependencies retain their own licenses.
