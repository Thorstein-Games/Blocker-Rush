"use client";

import { useEffect } from "react";
import { startCloudSync } from "../lib/cloudSync";

/** Syncs daily progress for signed-in players (see lib/cloudSync.ts). */
export default function CloudSync() {
  useEffect(startCloudSync, []);
  return null;
}
