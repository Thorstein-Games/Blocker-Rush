import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

// Crawlers only read robots.txt at the origin root, so this file (served at
// /blocker-rush/robots.txt) is advisory. thorsteingames.com's own robots.txt
// should list the sitemap below for Google to discover it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
