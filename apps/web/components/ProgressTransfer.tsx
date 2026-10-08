"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type ProgressData,
  decodeTransfer,
  encodeTransfer,
  getDateKey,
  mergeProgressData,
} from "@blocker-rush/shared";
import GameHeader from "./GameHeader";
import ThemeSelect from "./ThemeSelect";
import { getBestStreak, reconcileStats } from "./dailyStats";
import {
  readDailyStats,
  readSolveHistory,
  writeDailyStats,
  writeSolveHistory,
} from "./dailyStorage";
import { BASE_PATH } from "../lib/basePath";

const localProgress = (): ProgressData => ({
  stats: readDailyStats(),
  history: readSolveHistory(),
});

const describe = (data: ProgressData) => {
  const solved = Object.keys(data.history).length;
  // The streak as of today: a lapsed one shows as 0.
  const streak = reconcileStats(data.stats, getDateKey(new Date())).streak;
  return `${streak}-day streak, best ${getBestStreak(data.stats)}, ${solved} ${
    solved === 1 ? "puzzle" : "puzzles"
  } solved`;
};

type Incoming =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ready"; data: ProgressData }
  | { kind: "added"; data: ProgressData };

/**
 * /transfer: moves daily progress between devices with no server. The
 * sending device copies a link whose #fragment holds its progress (see
 * transfer.ts in the shared package); opening it on the other device
 * offers to merge that progress into this one.
 */
export default function ProgressTransfer() {
  // localStorage and the URL fragment are only readable after mount.
  const [local, setLocal] = useState<ProgressData | null>(null);
  const [incoming, setIncoming] = useState<Incoming>({ kind: "none" });
  const [pasted, setPasted] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setLocal(localProgress());
    setCanShare("share" in navigator);
    const hash = window.location.hash;
    if (!hash.includes("p=")) return;
    const data = decodeTransfer(hash);
    setIncoming(data ? { kind: "ready", data } : { kind: "invalid" });
    // Keep the progress out of the address bar (and of a reload re-offering it).
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const link = () =>
    `${window.location.origin}${BASE_PATH}/transfer#p=${encodeTransfer(localProgress())}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setStatus("Link copied. Open it on your other device.");
    } catch {
      setStatus("Couldn't copy. Try the Share button instead.");
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ title: "Blocker Rush progress", url: link() });
    } catch {
      // Cancelled.
    }
  };

  const addIncoming = (data: ProgressData) => {
    const merged = mergeProgressData(localProgress(), data);
    writeDailyStats(merged.stats);
    writeSolveHistory(merged.history);
    setLocal(merged);
    setIncoming({ kind: "added", data: merged });
  };

  return (
    <main className="page archive-page">
      <GameHeader
        mode="daily"
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="archive transfer" aria-labelledby="transfer-heading">
        <h2 id="transfer-heading">Move your progress</h2>

        {incoming.kind === "ready" && (
          <div className="panel transfer-card">
            <h3>Progress from another device</h3>
            <p>{describe(incoming.data)}.</p>
            <p className="transfer-note">
              Adding it combines it with this device&apos;s progress: nothing
              here is lost, and the better result of any day you solved on
              both is kept.
            </p>
            <div className="settings-actions">
              <button className="button" type="button" onClick={() => addIncoming(incoming.data)}>
                Add to this device
              </button>
            </div>
          </div>
        )}
        {incoming.kind === "added" && (
          <div className="notice" role="status">
            Added. This device now has: {describe(incoming.data)}.{" "}
            <Link href="/">Play today&apos;s puzzle</Link>
          </div>
        )}
        {incoming.kind === "invalid" && (
          <div className="notice" role="status">
            This transfer link is incomplete or damaged. Copy it again from
            the other device.
          </div>
        )}

        <div className="panel transfer-card">
          <h3>Send this device&apos;s progress</h3>
          <p>{local ? `${describe(local)}.` : "Loading…"}</p>
          <p className="transfer-note">
            Your streak and solve times go into the link itself. Nothing is
            uploaded; anyone with the link can see your stats.
          </p>
          <div className="settings-actions">
            <button className="button" type="button" onClick={copyLink} disabled={!local}>
              Copy link
            </button>
            {canShare && (
              <button className="button secondary" type="button" onClick={shareLink} disabled={!local}>
                Share
              </button>
            )}
          </div>
          {status && (
            <p className="transfer-note" role="status">
              {status}
            </p>
          )}
        </div>

        <form
          className="panel transfer-card"
          onSubmit={(event) => {
            event.preventDefault();
            const data = decodeTransfer(pasted);
            setIncoming(data ? { kind: "ready", data } : { kind: "invalid" });
            if (data) setPasted("");
          }}
        >
          <h3>
            <label htmlFor="transfer-input">Paste a link from another device</label>
          </h3>
          <div className="transfer-row">
            <input
              id="transfer-input"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="https://…/transfer#p=…"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="button secondary" type="submit" disabled={!pasted.trim()}>
              Read link
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
