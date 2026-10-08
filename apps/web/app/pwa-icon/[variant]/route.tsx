import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// PNG app icons for the web manifest, rendered from the logo SVG at build
// time. Android/Chrome want 192px and 512px PNGs before offering "Install";
// the maskable variant pads the logo into the safe zone so launchers can
// crop it to a circle or squircle.
export const dynamic = "force-static";
export const dynamicParams = false;

const VARIANTS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const;

type Variant = keyof typeof VARIANTS;

export const generateStaticParams = () =>
  Object.keys(VARIANTS).map((variant) => ({ variant }));

const logo = () =>
  `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public/favicon.svg")).toString("base64")}`;

export function GET(_request: Request, { params }: { params: { variant: string } }) {
  const variant = VARIANTS[params.variant as Variant];
  if (!variant) return new Response("Not found", { status: 404 });
  const { size, maskable } = variant;
  // Maskable icons keep their content inside the central 80% circle.
  const logoSize = maskable ? Math.round(size * 0.72) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#081117" : "transparent",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={logo()} width={logoSize} height={logoSize} />
      </div>
    ),
    { width: size, height: size },
  );
}
