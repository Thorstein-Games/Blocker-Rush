import type { Metadata } from "next";

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

const envSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const SITE_URL = normalizeSiteUrl(
  envSiteUrl ?? "https://blocker-rush.com",
);

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
