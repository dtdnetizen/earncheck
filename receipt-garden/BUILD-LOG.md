# Build and verification log

**2026-09-28, local preparation:** Next.js 16.3.6 produced a static export of the public Sanity dataset with three published synthetic offers. The home page contained the build snapshot disclosure and explicit no-real-income text. `/studio/` was generated as static HTML, with a Pages rewrite rule for Studio subpaths. The output contained 237 files; the largest was under 3 MB.

`npm run build` passed with public project and dataset settings. `npm test` passed 7 of 7 classification tests, and `npm run typecheck` passed. The export was scanned for private workspace path, account-name, write-token, and claim-token markers; none were found.

These checks do not establish that the site was deployed, that Cloudflare rewrites work on the public URL, that Studio authentication or editing works, or that a contest entry was published. The public garden only refreshes after a rebuild and upload.
