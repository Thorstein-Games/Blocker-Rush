import { createSocialImage } from "../lib/social-image";

export const alt = "Blocker Rush logo";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpenGraphImage() {
  return createSocialImage(size);
}
