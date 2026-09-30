// Served at thorsteingames.com/blocker-rush: the thorstein-games-website
// Next app rewrites /blocker-rush/* to this site, so every route and asset
// has to live under the same prefix.
const basePath = "/blocker-rush";
const canonicalOrigin = "https://thorsteingames.com";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath,
  env: {
    // Read via lib/basePath.ts for URLs Next doesn't prefix on its own
    // (raw <img>, history.replaceState, metadata icons, manifest).
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  transpilePackages: ["@blocker-rush/shared"],
  experimental: {
    typedRoutes: false
  },
  async redirects() {
    // Netlify sets CONTEXT at build time. Only production sends visitors
    // who hit blocker-rush.netlify.app directly over to the canonical
    // domain; deploy previews and local dev keep working in place.
    if (process.env.CONTEXT !== "production") return [];
    return [
      {
        // Anything outside the base path (the old root URLs). Requests
        // proxied from thorsteingames.com always arrive under /blocker-rush,
        // so this can't loop.
        source: `/:path((?!${basePath.slice(1)}(?:/|$)).*)`,
        destination: `${canonicalOrigin}${basePath}/:path`,
        basePath: false,
        permanent: true
      }
    ];
  }
};

export default nextConfig;
