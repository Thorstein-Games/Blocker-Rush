import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Oxanium, Space_Grotesk } from "next/font/google";
import InteractiveGridBackground from "../components/background/InteractiveGridBackground";
import Analytics from "../components/Analytics";
import ServiceWorker from "../components/ServiceWorker";
import {
  DEFAULT_KEYWORDS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  jsonLdScript,
  webSiteJsonLd,
} from "../lib/seo";
import { withBasePath } from "../lib/basePath";

// Self-hosted by next/font: no render-blocking request to Google Fonts, and
// size-adjusted fallbacks avoid layout shift while the font loads.
const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

const displayFont = Oxanium({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} – Free Daily Block Puzzle Like Genius Square`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  category: "games",
  openGraph: {
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      {
        url: withBasePath("/favicon.ico"),
      },
      {
        url: withBasePath("/favicon-32x32.png"),
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: withBasePath("/favicon.svg"),
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: withBasePath("/apple-icon"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: withBasePath("/manifest.webmanifest"),
};

export const viewport: Viewport = {
  themeColor: "#08111d",
};

// Shared Thorstein Games bar and footer (see CLAUDE.md). The Playwright
// configs set this to "" so tests don't load it from production.
const TG_BAR_SRC =
  process.env.NEXT_PUBLIC_TG_BAR_SRC ?? "https://thorsteingames.com/tg-bar.js";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(webSiteJsonLd) }}
        />
        {TG_BAR_SRC && <script src={TG_BAR_SRC} async />}
        <InteractiveGridBackground />
        <tg-bar game="blocker-rush"></tg-bar>
        <tg-ad game="blocker-rush" format="rail" beside=".puzzle-workspace"></tg-ad>
        <div className="app-shell">{children}</div>
        <tg-ad game="blocker-rush" format="banner" className="page-ad"></tg-ad>
        {/* No own links: every page's SEO section already ends with them. */}
        <tg-footer game="blocker-rush"></tg-footer>
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
