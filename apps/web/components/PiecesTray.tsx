"use client";

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
  } = useGame();

  const activePiece = activePieceId
    ? PIECES.find((piece) => piece.id === activePieceId)
    : null;

  return (
    <div className="panel">
      <h3>Pieces</h3>
      <div className="tray">
        {PIECES.map((piece) => {
          const state = pieceStates[piece.id];
          const transform = getTransformFor(
            piece.id,
            state.rotation,
            state.flipped,
          );
          const placed = Boolean(board.placements[piece.id]);
          const cardClassName = [
            "piece-card",
            placed ? "placed" : null,
            activePieceId === piece.id ? "active" : null,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={piece.id}
              className={cardClassName}
              onPointerDown={(event) => onPiecePointerDown(event, piece.id)}
            >
              <div
                className="piece-grid"
                style={{
                  gridTemplateColumns: `repeat(${transform.width}, 18px)`,
                  gridTemplateRows: `repeat(${transform.height}, 18px)`,
                }}
              >
                {transform.cells.map((cell, index) => (
                  <div
                    key={index}
                    className="piece-cell"
                    style={{
                      gridColumn: cell.x + 1,
                      gridRow: cell.y + 1,
                      background: PIECE_COLORS[piece.id],
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {activePiece && (
        <div className="stack">
          <label>Active Piece</label>
          <div className="status-row">
            <span>{activePiece.name}</span>
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
        </div>
      )}
    </div>
  );
}
