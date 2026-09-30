import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export async function createSocialImage(size: { width: number; height: number }) {
  // Reuse the header's vector logo so sharing previews stay on brand.
  const logo = await readFile(join(process.cwd(), "app/icon.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at center, #1c2e36 0%, #0b1319 72%)",
      }}
    >
      <img
        src={logoSrc}
        alt="Blocker Rush logo"
        width={384}
        height={384}
        style={{
          borderRadius: 84,
          boxShadow: "0 24px 56px rgba(0, 0, 0, 0.32)",
        }}
      />
    </div>,
    size,
  );
}
