import { NextResponse } from "next/server";
import { withBasePath } from "../../lib/basePath";

export function GET(request: Request) {
  const iconUrl = new URL(withBasePath("/favicon-32x32.png"), request.url);
  return NextResponse.redirect(iconUrl, 308);
}
