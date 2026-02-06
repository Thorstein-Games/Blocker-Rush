"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PieceId } from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import WinnerFireworks from "./multiplayer/WinnerFireworks";
import { useGame } from "./GameContext";

const WINNER_MESSAGES = [
  "That last snap hits just right.",
  "Clean finish. Puzzle locked.",
  "Perfect fit. No notes.",
  "You solved it like clockwork.",
  "Board cleared. Momentum maintained.",
  "Every move paid off.",
  "Precision win. Nicely done.",
  "That was a sharp close.",
  "Solved with style.",
  "Another puzzle in the books.",
] as const;

let winnerMessageCursor = 0;

export default function GameBoard() {
  const {
    board,
    ghost,
    draggingPieceId,
    dragPreview,
    pieceStates,
    getTransformFor,
    onBoardPointerDown,
    onBoardClick,
    onBoardDoubleClick,
    boardRef,
    solved,
    readOnly,
  } = useGame();

  const boardCells = board.cells.map((cell, index) => {
    const isBlocker = cell === "blocker";
    const isPiece = cell && cell !== "blocker";
    const className = [
      "board-cell",
      isBlocker ? "blocker" : null,
      isPiece ? "piece" : null,
      isPiece ? "block-cell" : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={index}
        className={className}
        data-index={index}
        style={
          isPiece
            ? ({
                "--block-color": PIECE_COLORS[cell as PieceId],
              } as CSSProperties)
            : undefined
        }
      />
    );
  });

  const dragPreviewTransform = dragPreview
    ? getTransformFor(
        dragPreview.pieceId,
        pieceStates[dragPreview.pieceId].rotation,
        pieceStates[dragPreview.pieceId].flipped,
      )
    : null;

  const dragPreviewPosition =
    dragPreview?.isDropping && dragPreview.dropTarget
      ? dragPreview.dropTarget
      : dragPreview?.position;
  const [winnerMessage, setWinnerMessage] = useState<string>(
    WINNER_MESSAGES[0] ?? "Puzzle solved.",
  );
  const wasSolvedRef = useRef(solved);

  useEffect(() => {
    if (solved && !wasSolvedRef.current) {
      const nextMessage =
        WINNER_MESSAGES[winnerMessageCursor % WINNER_MESSAGES.length] ??
        "Puzzle solved.";
      winnerMessageCursor += 1;
      setWinnerMessage(nextMessage);
    }

    wasSolvedRef.current = solved;
  }, [solved]);

  return (
    <div className="board-area">
      <div className="board-shell">
        <div
          className="board"
          ref={boardRef as React.RefObject<HTMLDivElement>}
          onPointerDown={readOnly ? undefined : onBoardPointerDown}
          onClick={readOnly ? undefined : onBoardClick}
          onDoubleClick={readOnly ? undefined : onBoardDoubleClick}
          style={
            {
              "--cols": board.size.cols,
              "--rows": board.size.rows,
            } as CSSProperties
          }
        >
          {boardCells}
          {ghost?.valid && draggingPieceId && (
            <div
              className="ghost"
              style={
                {
                  "--block-color": PIECE_COLORS[draggingPieceId],
                } as CSSProperties
              }
            >
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
                    className="ghost-cell block-cell"
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
        {dragPreview && dragPreviewTransform && (
          <div className="drag-preview-layer">
            <div
              className={[
                "drag-preview",
                dragPreview.isDropping ? "dropping" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  "--drag-x": `${dragPreviewPosition?.x ?? 0}px`,
                  "--drag-y": `${dragPreviewPosition?.y ?? 0}px`,
                  "--drag-cell": `${dragPreview.cell}px`,
                  "--drag-gap": `${dragPreview.gap}px`,
                  "--drag-cols": dragPreviewTransform.width,
                  "--drag-rows": dragPreviewTransform.height,
                  "--drag-offset-x": `${dragPreview.offset.x}px`,
                  "--drag-offset-y": `${dragPreview.offset.y}px`,
                  "--drag-scale": dragPreview.scale,
                  "--block-color": PIECE_COLORS[dragPreview.pieceId],
                } as CSSProperties
              }
            >
              <div className="drag-preview-grid">
                {dragPreviewTransform.cells.map((cell, idx) => (
                  <div
                    key={idx}
                    className="drag-cell block-cell"
                    style={{
                      gridColumn: cell.x + 1,
                      gridRow: cell.y + 1,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {solved && (
          <div className="celebration">
            <WinnerFireworks className="celebration-fireworks" />
            <div className="celebration-card">
              <strong>Puzzle Complete</strong>
              <span>{winnerMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
