import { createSocialImage } from "../../lib/social-image";

// A route rather than the opengraph-image.tsx convention, whose URL has no
// extension: GitHub Pages picks the Content-Type from the extension.
// lib/seo.ts links it for Open Graph and Twitter alike.
export const dynamic = "force-static";

export function GET() {
  return createSocialImage({ width: 1200, height: 630 });
}
