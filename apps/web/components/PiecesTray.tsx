"use client";

import type { CSSProperties } from "react";
import { PIECES } from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import { useGame } from "./GameContext";

export default function PiecesTray() {
  const {
    pieceStates,
    activePieceId,
    board,
    getTransformFor,
    onPiecePointerDown,
    rotatePiece,
    flipPiece,
    draggingPieceId,
  } = useGame();

  const activePiece = activePieceId
    ? PIECES.find((piece) => piece.id === activePieceId)
    : null;

  return (
    <div className="pieces-area">
      <div className="pieces-header">
        <h3>Pieces</h3>
        {activePiece ? (
          <div className="pieces-controls">
            <span>Active: {activePiece.name}</span>
            {rotatePiece && (
              <button
                className="button secondary"
                type="button"
                onClick={() => rotatePiece(activePiece.id)}
              >
                Rotate
              </button>
            )}
            {flipPiece && (
              <button
                className="button secondary"
                type="button"
                onClick={() => flipPiece(activePiece.id)}
              >
                Flip
              </button>
            )}
          </div>
        ) : (
          <span className="pieces-hint">Tap a piece to start.</span>
        )}
      </div>
      <div className="pieces-tray">
        {PIECES.filter(
          (piece) =>
            !board.placements[piece.id] && draggingPieceId !== piece.id,
        ).map((piece) => {
          const state = pieceStates[piece.id];
          const transform = getTransformFor(
            piece.id,
            state.rotation,
            state.flipped,
          );
          const placed = Boolean(board.placements[piece.id]);
          const slotClassName = [
            "piece-slot",
            placed ? "placed" : null,
            activePieceId === piece.id ? "active" : null,
            draggingPieceId === piece.id ? "dragging" : null,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={piece.id}
              className={slotClassName}
              type="button"
              onPointerDown={(event) => onPiecePointerDown(event, piece.id)}
              aria-pressed={activePieceId === piece.id}
              aria-label={`Select ${piece.name}`}
            >
              <div
                className="piece-grid"
                style={{
                  gridTemplateColumns: `repeat(${transform.width}, var(--tray-cell))`,
                  gridTemplateRows: `repeat(${transform.height}, var(--tray-cell))`,
                }}
              >
                {transform.cells.map((cell, index) => (
                  <div
                    key={index}
                    className="piece-cell block-cell"
                    style={
                      {
                        gridColumn: cell.x + 1,
                        gridRow: cell.y + 1,
                        "--block-color": PIECE_COLORS[piece.id],
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
