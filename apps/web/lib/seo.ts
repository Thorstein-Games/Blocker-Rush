import type { Metadata } from "next";
import { BASE_PATH } from "./basePath";

export const SITE_NAME = "Blocker Rush";
export const PUBLISHER_NAME = "Thorstein Games";

export const SITE_DESCRIPTION =
  "Play Blocker Rush free in your browser: a daily block puzzle in the style of The Genius Square. Fit 9 pieces around 7 blockers on a 6×6 board, practice unlimited puzzles, or race friends online.";

export const DEFAULT_KEYWORDS = [
  "blocker rush",
  "genius square online",
  "genius square game",
  "daily puzzle",
  "block puzzle",
  "logic puzzle",
  "brain game",
  "multiplayer puzzle game",
  "free online puzzle",
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

export const SITE_ORIGIN = normalizeSiteUrl(
  envSiteOrigin ?? "https://thorsteingames.com",
);

// Includes BASE_PATH, no trailing slash.
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`;

type PagePath = `/${string}` | "/";

/**
 * Absolute URL for a page. The home page is SITE_URL itself: Next serves
 * the base path without a trailing slash and redirects `/blocker-rush/` to
 * it, so a relative "/" canonical (which Next resolves to the slashed form)
 * would point Google at a redirect.
 */
export const pageUrl = (path: PagePath): string =>
  path === "/" ? SITE_URL : `${SITE_URL}${path}`;

const socialImageUrl = `${SITE_URL}/opengraph-image`;

type BuildPageMetadataInput = {
  /** Shown in search results; the layout template appends " | Blocker Rush". */
  title: string;
  /** Use the title as-is, skipping the layout template. */
  absoluteTitle?: boolean;
  description: string;
  path: PagePath;
  keywords?: string[];
};

export const buildPageMetadata = ({
  title,
  absoluteTitle = false,
  description,
  path,
  keywords,
}: BuildPageMetadataInput): Metadata => {
  const url = pageUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: keywords ?? DEFAULT_KEYWORDS,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [`${SITE_URL}/twitter-image`],
    },
  };
};

export type Faq = { question: string; answer: string };

const publisher = {
  "@type": "Organization",
  name: PUBLISHER_NAME,
  url: SITE_ORIGIN,
};

export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "en-US",
  description: SITE_DESCRIPTION,
  publisher,
};

export const videoGameJsonLd = {
  "@context": "https://schema.org",
  "@type": ["VideoGame", "WebApplication"],
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: socialImageUrl,
  inLanguage: "en-US",
  genre: ["Puzzle", "Logic"],
  gamePlatform: ["Web browser", "Mobile web"],
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  playMode: ["SinglePlayer", "MultiPlayer"],
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  author: publisher,
  publisher,
};

export const faqJsonLd = (faqs: Faq[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
});

/** Trail below the home page, outermost first: [["Casual practice", "/casual"]]. */
export const breadcrumbJsonLd = (...trail: Array<[name: string, path: PagePath]>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
    ...trail.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 2,
      name,
      item: pageUrl(path),
    })),
  ],
});

/** Serialises JSON-LD for a <script> body; escapes `<` so text can't close it. */
export const jsonLdScript = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c");
