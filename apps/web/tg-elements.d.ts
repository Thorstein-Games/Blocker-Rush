// The shared Thorstein Games bar/footer elements from
// https://thorsteingames.com/tg-bar.js (see CLAUDE.md).
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type TgElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  game?: string;
  limit?: number;
  // React 18 writes `className` on custom elements as a literal attribute, so
  // use `class` on these tags.
  class?: string;
  format?: "banner" | "box" | "rail";
  beside?: string;
  side?: "left" | "right";
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tg-bar": TgElement;
      "tg-footer": TgElement;
      "tg-more-games": TgElement;
      "tg-ad": TgElement;
    }
  }
}
