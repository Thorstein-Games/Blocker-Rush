// TODO(analytics): not live yet. To turn it on:
//   1. Create a Plausible account (plausible.io, or self-host) and add the
//      site thorsteingames.com.
//   2. In Netlify, set NEXT_PUBLIC_PLAUSIBLE_DOMAIN=thorsteingames.com for
//      production (and NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC if Plausible gives you
//      a site-specific script URL), then redeploy; it's read at build time.
//   3. In Plausible, add the custom events below as goals so they show up.
//
// Privacy-friendly analytics via Plausible (no cookies, so no consent
// banner). Off unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set at build time; then
// <Analytics /> loads the script and track() sends custom events.
//
// The domain is the one registered in Plausible: thorsteingames.com, since
// the game is served there under /blocker-rush. Set
// NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC for a self-hosted instance or a
// site-specific script URL.

export const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
export const PLAUSIBLE_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC ?? "https://plausible.io/js/script.js";

export type AnalyticsEvent =
  | "Daily Solved"
  | "Archive Solved"
  | "Hint"
  | "Casual Solved"
  | "Share"
  | "Multiplayer Join Public"
  | "Multiplayer Join Code"
  | "Multiplayer Create Private";

type Props = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, options?: { props?: Props }) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

export const track = (event: AnalyticsEvent, props?: Props): void => {
  if (!PLAUSIBLE_DOMAIN || typeof window === "undefined") return;
  try {
    // The inline stub in <Analytics /> queues calls made before the script
    // loads, so this never drops early events.
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // Analytics must never break gameplay.
  }
};
