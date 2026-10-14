import { faviconImage } from "../../lib/faviconImage";

export const dynamic = "force-static";

export function GET() {
  return faviconImage();
}
