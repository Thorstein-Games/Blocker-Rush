"use client";

import { useMemo } from "react";
import type { TrackedPlayer } from "./useMultiplayerSocket";
import { buildMiniCells, formatMs } from "./multiplayerViewUtils";

type OpponentCardProps = {
  player: TrackedPlayer;
  showSplits: boolean;
};

export default function OpponentCard({ player, showSplits }: OpponentCardProps) {
  const cells = useMemo(
    () =>
      player.round?.puzzleId
        ? buildMiniCells(player.round.placedPieces, player.round.puzzleId)
        : Array.from({ length: 36 }, () => null),
    [player.round?.placedPieces, player.round?.puzzleId],
  );

  return (
    <article className="opponent-card">
      <header>
        <strong>{player.name}</strong>
        <span className="pieces-hint">
          Round {player.currentRoundIndex + 1}
        </span>
      </header>
      <div className="opponent-mini-board">
        {cells.map((cell, index) => (
          <div
            key={index}
            className={[
              "opponent-mini-cell",
              cell === "blocker" ? "blocker" : null,
              cell && cell !== "blocker" ? "piece" : null,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
      {showSplits && (
        <div className="pieces-hint">
          Splits:{" "}
          {player.splitsMs
            .map((split) => (split ? formatMs(split) : "--"))
            .join(" · ")}
        </div>
      )}
    </article>
  );
}
