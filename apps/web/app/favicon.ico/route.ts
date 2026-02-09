import { NextResponse } from "next/server";

export function GET(request: Request) {
  const iconUrl = new URL("/favicon-32x32.png", request.url);
  return NextResponse.redirect(iconUrl, 308);
}
