"use client";

import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  PIECES,
  canPlace,
  type PieceId,
  type Placement,
} from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import WinnerFireworks from "./multiplayer/WinnerFireworks";
import { useGame } from "./GameContext";

const WINNER_MESSAGES = [
  "That last snap hits just right.",
  "Clean finish. Puzzle locked.",
  "Perfect fit. No notes.",
  "You solved it like clockwork.",
  "Board filled. Momentum maintained.",
  "Every move paid off.",
  "Precision win. Nicely done.",
  "That was a sharp close.",
  "Solved with style.",
  "Yo! Champ in the making!",
  "Another puzzle in the books.",
] as const;

const getRandomWinnerMessage = () => {
  const index = Math.floor(Math.random() * WINNER_MESSAGES.length);
  return WINNER_MESSAGES[index];
};

type GameBoardProps = {
  overlay?: ReactNode;
  hintPlacement?: Placement | null;
};

export default function GameBoard({ overlay, hintPlacement }: GameBoardProps) {
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
    activePieceId,
    activateCell,
    feedback,
  } = useGame();
  const [winnerMessage] = useState(getRandomWinnerMessage());
  const instructionsId = useId();
  const shapeId = useId();
  const [cursor, setCursor] = useState(0);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const activePiece = PIECES.find((piece) => piece.id === activePieceId);
  const availablePiece =
    activePieceId && !board.placements[activePieceId] ? activePieceId : null;
  const selectedTransform = availablePiece
    ? getTransformFor(
        availablePiece,
        pieceStates[availablePiece].rotation,
        pieceStates[availablePiece].flipped,
      )
    : null;
  const activeHint =
    hintPlacement &&
    hintPlacement.pieceId === availablePiece &&
    selectedTransform?.id === hintPlacement.transformId
      ? hintPlacement
      : null;
  const cursorOrigin = {
    x: cursor % board.size.cols,
    y: Math.floor(cursor / board.size.cols),
  };
  const preview = draggingPieceId
    ? ghost
    : activeHint && selectedTransform
      ? {
          origin: activeHint.origin,
          valid: canPlace(board, selectedTransform, activeHint.origin),
        }
      : keyboardFocus && selectedTransform
        ? {
            origin: cursorOrigin,
            valid: canPlace(board, selectedTransform, cursorOrigin),
          }
        : null;
  const previewPiece = draggingPieceId ?? availablePiece;
  const focusCell = (index: number) => {
    setCursor(index);
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.focus();
  };
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
        role="gridcell"
        tabIndex={cursor === index ? 0 : -1}
        aria-rowindex={Math.floor(index / board.size.cols) + 1}
        aria-colindex={(index % board.size.cols) + 1}
        aria-label={`Row ${Math.floor(index / board.size.cols) + 1}, column ${(index % board.size.cols) + 1}: ${isBlocker ? "blocker" : isPiece ? PIECES.find((piece) => piece.id === cell)?.name : "empty"}`}
        onFocus={(event) => {
          setCursor(index);
          setKeyboardFocus(event.currentTarget.matches(":focus-visible"));
        }}
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

  return (
    <div className="board-area">
      <p className="game-objective">
        Fill every empty square with all 9 pieces.
      </p>
      <p className="sr-only" id={instructionsId}>
        Select a piece in the tray with Enter or Space. Arrow keys move between
        squares. Enter or Space places the selected piece. Delete or Backspace
        removes a piece. D or S rotates; F flips. Escape cancels selection.
      </p>
      <p className="sr-only" id={shapeId}>
        {selectedTransform && activePiece
          ? `${activePiece.name}: ${selectedTransform.width} columns by ${selectedTransform.height} rows. Squares relative to the placement corner: ${selectedTransform.cells.map((cell) => `row ${cell.y + 1}, column ${cell.x + 1}`).join("; ")}.`
          : "No piece selected."}
      </p>
      <div className="board-shell">
        <div
          className="board"
          ref={boardRef as React.RefObject<HTMLDivElement>}
          role="grid"
          aria-label="Puzzle board"
          aria-rowcount={board.size.rows}
          aria-colcount={board.size.cols}
          aria-describedby={`${instructionsId} ${shapeId}`}
          aria-readonly={readOnly}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setKeyboardFocus(false);
          }}
          onKeyDown={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.nativeEvent.isComposing
            )
              return;
            const col = cursor % board.size.cols;
            const offsets: Record<string, number> = {
              ArrowRight: col < board.size.cols - 1 ? 1 : 0,
              ArrowLeft: col > 0 ? -1 : 0,
              ArrowDown:
                cursor + board.size.cols < board.cells.length
                  ? board.size.cols
                  : 0,
              ArrowUp: cursor >= board.size.cols ? -board.size.cols : 0,
              Home: -col,
              End: board.size.cols - col - 1,
            };
            const offset = offsets[event.key];
            if (offset !== undefined) {
              event.preventDefault();
              setKeyboardFocus(true);
              focusCell(cursor + offset);
            } else if (
              ["Enter", " ", "Delete", "Backspace"].includes(event.key)
            ) {
              event.preventDefault();
              activateCell(
                cursor,
                event.key === "Delete" || event.key === "Backspace",
              );
            }
          }}
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
          {Array.from({ length: board.size.rows }, (_, row) => (
            <div role="row" className="board-row" key={row}>
              {boardCells.slice(
                row * board.size.cols,
                (row + 1) * board.size.cols,
              )}
            </div>
          ))}
          {preview && previewPiece && (
            <div
              className={`ghost${preview.valid ? "" : " invalid"}`}
              aria-hidden="true"
              style={
                {
                  "--block-color": PIECE_COLORS[previewPiece],
                } as CSSProperties
              }
            >
              {(() => {
                const state = pieceStates[previewPiece];
                const transform = getTransformFor(
                  previewPiece,
                  state.rotation,
                  state.flipped,
                );
                return transform.cells.map((cell, idx) => (
                  <div
                    key={idx}
                    className="ghost-cell block-cell"
                    style={{
                      gridColumn: preview.origin.x + cell.x + 1,
                      gridRow: preview.origin.y + cell.y + 1,
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
        {overlay ? <div className="board-overlay">{overlay}</div> : null}
        {solved && (
          <div className="celebration" role="status">
            <WinnerFireworks className="celebration-fireworks" />
            <div className="celebration-card">
              <strong>Puzzle Complete</strong>
              <span>{winnerMessage}</span>
            </div>
          </div>
        )}
      </div>
      <div className="board-guidance">
        <p
          className={`board-feedback${feedback?.error ? " error" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {solved ? (
            "Every square filled. Puzzle complete!"
          ) : feedback?.error ? (
            <span key={feedback.sequence}>{feedback.text}</span>
          ) : activeHint ? (
            preview?.valid ? (
              `Hint: place ${activePiece?.name} on the outlined squares.`
            ) : (
              "Hint: these squares are occupied. Remove the pieces in the outlined area first."
            )
          ) : feedback ? (
            <span key={feedback.sequence}>{feedback.text}</span>
          ) : availablePiece && activePiece ? (
            `${activePiece.name} selected. Choose a square; Rotate or Flip to fit.`
          ) : Object.values(board.placements).filter(Boolean).length > 0 ? (
            "Double-tap a piece to remove it, or use Undo."
          ) : (
            "Choose a piece, then tap a square. You can also drag."
          )}
        </p>
      </div>
    </div>
  );
}
