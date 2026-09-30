import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "../../lib/seo";
import { withBasePath } from "../../lib/basePath";

// A route handler rather than the app/manifest.ts file convention: Next 14
// emits that convention's <link rel="manifest"> without basePath, and it
// overrides `manifest` in layout metadata. layout.tsx links here instead.
export const dynamic = "force-static";

export function GET() {
  return Response.json(manifest(), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}

function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: withBasePath("/"),
    display: "standalone",
    background_color: "#06101b",
    theme_color: "#08111d",
    icons: [
      {
        src: withBasePath("/favicon.svg"),
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: withBasePath("/favicon-32x32.png"),
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: withBasePath("/apple-icon"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
