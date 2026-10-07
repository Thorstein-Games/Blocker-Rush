"use client";

import { type CSSProperties } from "react";
import { PIECES } from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import { useGame } from "./GameContext";

type PiecesTrayProps = {
  /** Shows a Hint button next to Undo/Clear when set. */
  onHint?: () => void;
};

export default function PiecesTray({ onHint }: PiecesTrayProps = {}) {
  const {
    pieceStates,
    activePieceId,
    board,
    getTransformFor,
    onPiecePointerDown,
    rotatePiece,
    flipPiece,
    clearBoard,
    draggingPieceId,
    readOnly,
    undo,
    canUndo,
    selectPiece,
    boardRef,
  } = useGame();

  const activePiece =
    activePieceId && !board.placements[activePieceId]
      ? PIECES.find((piece) => piece.id === activePieceId)
      : null;

  const allPiecesPlaced = PIECES.every((piece) =>
    Boolean(board.placements[piece.id]),
  );
  const hasPlacedPieces = PIECES.some((piece) =>
    Boolean(board.placements[piece.id]),
  );

  if (allPiecesPlaced) {
    return null;
  }

  return (
    <div className="pieces-area" aria-label="Puzzle pieces">
      <div className="pieces-tray">
        <div className="pieces-header">
          <div className="pieces-recovery">
            <button
              className="button secondary"
              type="button"
              onClick={undo}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              className="button secondary pieces-clear"
              type="button"
              onClick={clearBoard}
              disabled={readOnly || !!draggingPieceId || !hasPlacedPieces}
            >
              Clear
            </button>
            {onHint && (
              <button
                className="button secondary"
                type="button"
                onClick={onHint}
                disabled={readOnly || !!draggingPieceId}
              >
                Hint
              </button>
            )}
          </div>
          <div className="pieces-header-actions">
            {activePiece ? (
              <div className="pieces-controls">
                {rotatePiece && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => rotatePiece(activePiece.id)}
                    aria-keyshortcuts="D S"
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
                    aria-keyshortcuts="F"
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
        </div>
        <div className="pieces-grid">
          {PIECES.map((piece) => {
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
                onClick={(event) => {
                  if (event.detail !== 0) return;
                  selectPiece(piece.id);
                  boardRef.current
                    ?.querySelector<HTMLElement>('[tabindex="0"]')
                    ?.focus();
                }}
                aria-pressed={activePieceId === piece.id}
                aria-label={
                  placed ? `${piece.name} placed` : `Select ${piece.name}`
                }
                aria-description={`${transform.cells.length} squares, ${transform.width} columns by ${transform.height} rows. Enter or Space selects this piece and focuses the board.`}
                disabled={readOnly || placed}
              >
                <div
                  className="piece-grid"
                  style={
                    {
                      "--piece-cols": transform.width,
                      "--piece-rows": transform.height,
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
                {placed && <span className="piece-placed-label">Placed</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
