"use client";

import { useEffect } from "react";
import { BASE_PATH } from "../lib/basePath";

/**
 * Registers public/sw.js (offline play) in production builds. Skipped in
 * development, where a cache-first worker would serve stale dev bundles.
 *
 * The scope is the script's own directory, BASE_PATH + "/", which covers
 * every page (they all end in a slash, including the home page). GitHub
 * Pages can't send the Service-Worker-Allowed header a wider scope needs.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const scope = `${BASE_PATH}/`;
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope })
      .catch(() => {
        // Offline support is a bonus; the game works without it.
      });
    // Workers registered for the old unslashed scope can't update without
    // that header, so drop them.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        registrations
          .filter((registration) => new URL(registration.scope).pathname === BASE_PATH)
          .forEach((registration) => registration.unregister()),
      )
      .catch(() => {});
  }, []);
  return null;
}
