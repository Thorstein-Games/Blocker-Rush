"use client";

import { useMemo, type CSSProperties } from "react";
import { PIECES, PIECE_TRANSFORMS } from "@blocker-rush/shared";
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
    readOnly,
  } = useGame();

  const activePiece = activePieceId
    ? PIECES.find((piece) => piece.id === activePieceId)
    : null;

  const trayBoundsByPieceId = useMemo(() => {
    return PIECES.reduce<Record<string, { cols: number; rows: number }>>(
      (acc, piece) => {
        const transforms = PIECE_TRANSFORMS[piece.id];
        const maxCols = Math.max(...transforms.map((entry) => entry.width));
        const maxRows = Math.max(...transforms.map((entry) => entry.height));
        acc[piece.id] = { cols: maxCols, rows: maxRows };
        return acc;
      },
      {},
    );
  }, []);

  const allPiecesPlaced = PIECES.every((piece) =>
    Boolean(board.placements[piece.id]),
  );

  if (allPiecesPlaced) {
    return null;
  }

  return (
    <div className="pieces-area">
      <div className="pieces-tray">
        <div className="pieces-header">
          <span className="status-row">Keys D or S rotate. F flips</span>
          {/* Need this empty span to push the pieces-controls to the right on mobile */}
          <span></span>
          {activePiece ? (
            <div className="pieces-controls">
              {rotatePiece && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => rotatePiece(activePiece.id)}
                  disabled={readOnly}
                >
                  Rotate
                </button>
              )}
              {flipPiece && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => flipPiece(activePiece.id)}
                  disabled={readOnly}
                >
                  Flip
                </button>
              )}
            </div>
          ) : (
            <span className="pieces-hint">Tap or drag a piece</span>
          )}
        </div>
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
          const trayBounds = trayBoundsByPieceId[piece.id] ?? {
            cols: transform.width,
            rows: transform.height,
          };
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
              disabled={readOnly}
            >
              <div
                className="piece-grid"
                style={
                  {
                    "--piece-cols": trayBounds.cols,
                    "--piece-rows": trayBounds.rows,
                    gridTemplateColumns: `repeat(${transform.width}, var(--tray-cell))`,
                    gridTemplateRows: `repeat(${transform.height}, var(--tray-cell))`,
                  } as CSSProperties
                }
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
