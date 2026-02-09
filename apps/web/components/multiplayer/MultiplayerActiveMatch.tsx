"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { PIECE_COLORS } from "../pieceColors";
import MultiplayerBoardPanel from "./MultiplayerBoardPanel";
import OpponentCard from "./OpponentCard";
import { useMultiplayerStore } from "./MultiplayerStore";
import { buildMiniCells, formatMs } from "./multiplayerViewUtils";

const EMPTY_BOARD_CELLS = Array.from({ length: 36 }, () => null);

export default function MultiplayerActiveMatch() {
  const { state, startMatch, leaveRoom, sendPlace, sendRemove, submitFinish } =
    useMultiplayerStore();

  const [renderNow, setRenderNow] = useState(() => Date.now());
  const shouldTickTimer =
    state.status === "countdown" || state.status === "in_game";

  useEffect(() => {
    if (!shouldTickTimer) return;

    setRenderNow(Date.now());
    const timer = window.setInterval(() => setRenderNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shouldTickTimer]);

  const players = useMemo(() => Object.values(state.players), [state.players]);
  const selfPlayer = state.selfPlayerId
    ? state.players[state.selfPlayerId]
    : undefined;
  const selfIsHost = state.hostId === state.selfPlayerId;
  const opponents = players.filter(
    (player) => player.playerId !== state.selfPlayerId,
  );
  const isFinished = state.status === "finished";

  const adjustedNow = renderNow + state.clockOffsetMs;
  const countdownMs =
    state.status === "countdown" && state.match
      ? Math.max(0, state.match.startTime - adjustedNow)
      : 0;
  const countdownLabel =
    countdownMs > 2000
      ? "3"
      : countdownMs > 1000
        ? "2"
        : countdownMs > 0
          ? "1"
          : "Go!";
  const roundElapsedMs =
    state.status === "in_game" && selfPlayer?.round?.startedAt
      ? Math.max(0, adjustedNow - selfPlayer.round.startedAt)
      : 0;

  const authoritativeReject =
    state.lastRejected?.authoritativeState && selfPlayer
      ? {
          roundIndex: state.lastRejected.authoritativeState.roundIndex,
          placedPieces: state.lastRejected.authoritativeState.placedPieces,
        }
      : undefined;

  const finishedPlayers = useMemo(() => {
    const winnerId = state.result?.winnerId;
    const placementsByPlayer = new Map(
      (state.result?.placements ?? []).map((placement) => [
        placement.playerId,
        placement,
      ]),
    );

    return [...players]
      .sort((a, b) => {
        const aWinner = a.playerId === winnerId ? -1 : 0;
        const bWinner = b.playerId === winnerId ? -1 : 0;
        if (aWinner !== bWinner) return aWinner - bWinner;

        const aPlacement = placementsByPlayer.get(a.playerId)?.place;
        const bPlacement = placementsByPlayer.get(b.playerId)?.place;
        if (aPlacement && bPlacement && aPlacement !== bPlacement) {
          return aPlacement - bPlacement;
        }
        if (aPlacement && !bPlacement) return -1;
        if (!aPlacement && bPlacement) return 1;

        return a.name.localeCompare(b.name);
      })
      .map((player) => {
        const placement = placementsByPlayer.get(player.playerId);
        const splits =
          state.result?.splitsByPlayer[player.playerId] ?? player.splitsMs;
        const completedSplits = splits.filter(
          (split): split is number => split !== null,
        );
        const totalMs =
          completedSplits.length > 0
            ? completedSplits.reduce((acc, split) => acc + split, 0)
            : null;
        const cells =
          player.round?.puzzleId && player.round.placedPieces
            ? buildMiniCells(player.round.placedPieces, player.round.puzzleId)
            : EMPTY_BOARD_CELLS;

        return {
          player,
          cells,
          roundsCompleted: completedSplits.length,
          totalMs,
          isWinner: player.playerId === winnerId,
          place: placement?.place,
        };
      });
  }, [players, state.result]);

  const winnerDisplayName = state.result?.winnerId
    ? (state.players[state.result.winnerId]?.name ?? state.result.winnerId)
    : "--";
  const winnerTimeMs =
    finishedPlayers.find((entry) => entry.isWinner)?.totalMs ?? null;

  return (
    <section
      className={[
        "multiplayer-game-layout",
        isFinished ? "multiplayer-game-layout-finished" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!isFinished && (
        <aside className="opponents-column">
          <h3>Opponents</h3>
          <div className="opponents-grid">
            {opponents.length === 0 ? (
              <span className="pieces-hint">Waiting for players…</span>
            ) : (
              opponents.map((player) => (
                <OpponentCard
                  key={player.playerId}
                  player={player}
                  showSplits={state.settings.rounds > 1}
                />
              ))
            )}
          </div>
        </aside>
      )}

      <div className="game-center multiplayer-main-board">
        {state.error && <div className="notice">{state.error}</div>}

        {isFinished ? (
          <section className="multiplayer-finished-view">
            <div className="settings-actions multiplayer-finished-actions">
              {selfIsHost && (
                <button className="button" type="button" onClick={startMatch}>
                  Play Again with Same Group
                </button>
              )}
              <button
                className="button secondary"
                type="button"
                onClick={leaveRoom}
              >
                Return to Lobby
              </button>
            </div>
            <div className="multiplayer-finished-boards-grid">
              {finishedPlayers.map((entry) => (
                <article
                  className={[
                    "multiplayer-finished-board-card",
                    entry.isWinner ? "winner" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={entry.player.playerId}
                >
                  <header className="multiplayer-finished-board-header">
                    <strong>
                      {entry.player.name}
                      {entry.isWinner && (
                        <span
                          className="multiplayer-winner-crown"
                          aria-label="Winner"
                          title="Winner"
                        >
                          👑
                        </span>
                      )}
                    </strong>
                    <span className="pieces-hint">
                      Round {entry.player.currentRoundIndex + 1}
                    </span>
                  </header>
                  <div className="board multiplayer-finished-board">
                    {entry.cells.map((cell, index) => (
                      <div
                        key={index}
                        className={[
                          "board-cell",
                          cell === "blocker" ? "blocker" : null,
                          cell && cell !== "blocker"
                            ? "piece block-cell"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={
                          cell && cell !== "blocker"
                            ? ({
                                "--block-color":
                                  PIECE_COLORS[
                                    cell as keyof typeof PIECE_COLORS
                                  ],
                              } as CSSProperties)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <div className="multiplayer-finished-board-stats">
                    <span className="pieces-hint">
                      Time:{" "}
                      {entry.totalMs === null ? "--" : formatMs(entry.totalMs)}
                    </span>
                    <span className="pieces-hint">
                      Rounds: {entry.roundsCompleted}/{state.settings.rounds}
                    </span>
                    {entry.place ? (
                      <span className="pieces-hint">Place: #{entry.place}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <MultiplayerBoardPanel
            selfPlayer={selfPlayer}
            active={state.status === "in_game"}
            boardOverlay={
              state.status === "countdown" ? (
                <div className="countdown-overlay" aria-live="polite">
                  <span
                    key={countdownLabel}
                    className="countdown-overlay-value countdown-overlay-value-animated"
                  >
                    {countdownLabel}
                  </span>
                </div>
              ) : undefined
            }
            onPlace={sendPlace}
            onRemove={sendRemove}
            onSubmitFinish={submitFinish}
            authoritativeReject={authoritativeReject}
          />
        )}
      </div>
      {!isFinished && (
        <aside className="panel multiplayer-side-card">
          <h3>Match</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Round</span>
              <span className="stat-value">
                {selfPlayer ? selfPlayer.currentRoundIndex + 1 : 1} ·{" "}
                {state.status === "in_game" ? "Live" : "Locked"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Room</span>
              <span className="stat-value">{state.roomCode ?? "--"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Status</span>
              <span className="stat-value">{state.status ?? "--"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Timer</span>
              <span className="stat-value">
                {state.status === "countdown"
                  ? formatMs(countdownMs)
                  : formatMs(roundElapsedMs)}
              </span>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}
