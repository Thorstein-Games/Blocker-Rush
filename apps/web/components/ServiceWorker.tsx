"use client";

import { useEffect } from "react";
import { BASE_PATH } from "../lib/basePath";

/**
 * Registers public/sw.js (offline play) in production builds. Skipped in
 * development, where a cache-first worker would serve stale dev bundles.
 *
 * The scope is BASE_PATH without a trailing slash so it covers the home
 * page (/blocker-rush) as well as /blocker-rush/…; next.config.js sends
 * the Service-Worker-Allowed header that permits it.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: BASE_PATH || "/" })
      .catch(() => {
        // Offline support is a bonus; the game works without it.
      });
  }, []);
  return null;
}
