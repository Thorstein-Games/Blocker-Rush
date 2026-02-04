"use client";

import type { CSSProperties } from "react";
import type { PieceId } from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import { useGame } from "./GameContext";

export default function GameBoard() {
  const {
    board,
    ghost,
    draggingPieceId,
    pieceStates,
    getTransformFor,
    onBoardPointerDown,
    boardRef,
    solved,
  } = useGame();

  const boardCells = board.cells.map((cell, index) => {
    const isBlocker = cell === "blocker";
    const isPiece = cell && cell !== "blocker";
    const background = isPiece ? PIECE_COLORS[cell as PieceId] : undefined;
    const className = [
      "board-cell",
      isBlocker ? "blocker" : null,
      isPiece ? "piece" : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={index}
        className={className}
        data-index={index}
        style={{ background }}
      />
    );
  });

  return (
    <div className="board-area">
      <div className="board-shell">
        <div
          className="board"
          ref={boardRef}
          onPointerDown={onBoardPointerDown}
          style={
            {
              "--cols": board.size.cols,
              "--rows": board.size.rows,
            } as CSSProperties
          }
        >
          {boardCells}
          {ghost && draggingPieceId && (
            <div className={`ghost ${ghost.valid ? "valid" : "invalid"}`}>
              {(() => {
                const state = pieceStates[draggingPieceId];
                const transform = getTransformFor(
                  draggingPieceId,
                  state.rotation,
                  state.flipped,
                );
                return transform.cells.map((cell, idx) => (
                  <div
                    key={idx}
                    className="ghost-cell"
                    style={{
                      gridColumn: ghost.origin.x + cell.x + 1,
                      gridRow: ghost.origin.y + cell.y + 1,
                    }}
                  />
                ));
              })()}
            </div>
          )}
        </div>
        {solved && (
          <div className="celebration">
            <div className="celebration-card">
              <strong>Puzzle Complete</strong>
              <span>That last snap hits just right.</span>
            </div>
          </div>
        )}
      </div>
      <div className="status-row">
        <span>R to rotate. F to flip</span>
      </div>
    </div>
  );
}
