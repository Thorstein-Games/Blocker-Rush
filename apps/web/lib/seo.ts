import type { Metadata } from "next";
import { BASE_PATH } from "./basePath";

export const SITE_NAME = "Blocker Rush";

export const SITE_DESCRIPTION =
  "Blocker Rush is a fast logic puzzle game with a daily challenge, casual practice puzzles, and live multiplayer rooms.";

export const DEFAULT_KEYWORDS = [
  "blocker rush",
  "genius square",
  "logic puzzle",
  "daily puzzle",
  "brain game",
  "multiplayer puzzle",
  "puzzle game",
  "online puzzle",
];

const normalizeSiteUrl = (value: string): string => {
  const withProtocol =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
};

// Origin only (no path) — the game is served under BASE_PATH on
// thorsteingames.com via a proxy, so Netlify's own URL isn't canonical.
const envSiteOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;

// Includes BASE_PATH. Next joins relative metadata URLs (canonical, OG
// images) onto metadataBase's path, so those stay relative.
export const SITE_URL = `${normalizeSiteUrl(
  envSiteOrigin ?? "https://thorsteingames.com",
)}${BASE_PATH}`;

export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "en-US",
  description: SITE_DESCRIPTION,
};

type BuildPageMetadataInput = {
  title: string;
  description: string;
  path: `/${string}` | "/";
  keywords?: string[];
};

export const buildPageMetadata = ({
  title,
  description,
  path,
  keywords,
}: BuildPageMetadataInput): Metadata => ({
  title,
  description,
  keywords: keywords ?? DEFAULT_KEYWORDS,
  alternates: {
    canonical: path,
  },
  openGraph: {
    title,
    description,
    url: path,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} social preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image"],
  },
});
