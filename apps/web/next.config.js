// Served at thorsteingames.com/blocker-rush: the thorstein-games-website
// Next app rewrites /blocker-rush/* to this site, so every route and asset
// has to live under the same prefix. The site itself is hosted on GitHub
// Pages as a project site, which also lives at /blocker-rush.
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

const basePath = "/blocker-rush";

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  basePath,
  // GitHub Pages only serves files: `next build` writes the whole site to
  // out/ (deployed by .github/workflows/pages.yml). So no headers,
  // redirects or per-request rendering. Build only: Next 14's dev server
  // turns unlisted params of an export into 500s rather than 404s.
  output: phase === PHASE_PRODUCTION_BUILD ? "export" : undefined,
  // Every page is a directory with an index.html (out/daily/index.html),
  // which is how GitHub Pages resolves /daily/. It redirects /daily there.
  trailingSlash: true,
  env: {
    // Read via lib/basePath.ts for URLs Next doesn't prefix on its own
    // (raw <img>, history.replaceState, metadata icons, manifest).
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  transpilePackages: ["@blocker-rush/shared"],
  experimental: {
    typedRoutes: false
  }
});

export default nextConfig;
