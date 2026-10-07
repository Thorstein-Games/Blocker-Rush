import type { MetadataRoute } from "next";
import { pageUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: pageUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: pageUrl("/casual"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: pageUrl("/multiplayer"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
