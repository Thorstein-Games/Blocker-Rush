"use client";

import type { CSSProperties } from "react";
import { PIECE_COLORS } from "../pieceColors";
import { buildMiniCells } from "./multiplayerViewUtils";
import { useMultiplayerStore } from "./MultiplayerStore";
import WinnerFireworks from "./WinnerFireworks";

export default function MultiplayerResultModal() {
  const { state, startMatch, leaveRoom } = useMultiplayerStore();

  if (!state.result) return null;

  const selfIsHost = state.hostId === state.selfPlayerId;
  const winnerName = state.result.winnerId
    ? (state.players[state.result.winnerId]?.name ?? state.result.winnerId)
    : "";
  const selfIsWinner =
    Boolean(state.selfPlayerId) && state.result.winnerId === state.selfPlayerId;
  const winnerBoards = [...state.result.winnerBoards].sort(
    (a, b) => a.roundIndex - b.roundIndex,
  );

  return (
    <div className="multiplayer-result-modal-backdrop">
      <section
        className="multiplayer-result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-result-heading"
      >
        {selfIsWinner && (
          <WinnerFireworks className="multiplayer-result-fireworks" />
        )}
        <div className="multiplayer-result-header">
          <h3 id="match-result-heading">Match Result</h3>
          <p>
            Winner: <strong>{winnerName}</strong>
          </p>
        </div>
        {winnerBoards.length > 0 && (
          <div className="multiplayer-result-boards">
            <h4>Winning Solution</h4>
            <div className="multiplayer-result-boards-grid">
              {winnerBoards.map((roundBoard) => {
                const cells = buildMiniCells(
                  roundBoard.placedPieces,
                  roundBoard.puzzleId,
                );

                return (
                  <div
                    className="multiplayer-result-board-card"
                    key={`${roundBoard.roundIndex}:${roundBoard.puzzleId}`}
                  >
                    <span className="pieces-hint">
                      Round {roundBoard.roundIndex + 1}
                    </span>
                    <div className="board multiplayer-result-mini-board">
                      {cells.map((cell, index) => (
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="settings-actions multiplayer-result-actions">
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
      </section>
    </div>
  );
}
