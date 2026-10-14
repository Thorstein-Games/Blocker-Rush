import { faviconImage } from "../../lib/faviconImage";

// The same PNG as /favicon-32x32.png: a static host can't redirect, and
// browsers read PNG data served as .ico.
export const dynamic = "force-static";

export function GET() {
  return faviconImage();
}
