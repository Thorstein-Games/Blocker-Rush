"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  PIECES,
  canPlace,
  type PieceId,
  type Placement,
} from "@blocker-rush/shared";
import { PIECE_COLORS } from "./pieceColors";
import { OPEN_HELP_EVENT } from "./GameHeader";
import { placementCovering } from "./pieceGeometry";
import type { HintNotice } from "./useHint";
import WinnerFireworks from "./multiplayer/WinnerFireworks";
import { useGame } from "./GameContext";

// Shown under the board when the last piece goes in.
const WINNER_MESSAGES = [
  "Not a gap left. Worthy of a saga.",
  "Every square claimed. Odin nods.",
  "The shield wall holds.",
  "Forged without a crack.",
  "A fit fit for Valhalla.",
  "The skalds will sing of this one.",
  "Clean as a fresh-sharpened axe.",
  "Thor himself couldn't wedge a pebble in.",
] as const;

const getRandomWinnerMessage = () => {
  const index = Math.floor(Math.random() * WINNER_MESSAGES.length);
  return WINNER_MESSAGES[index];
};

type GameBoardProps = {
  overlay?: ReactNode;
  hintPlacement?: Placement | null;
  /** A hint in words (useHint), shown in the message line under the board. */
  hintNotice?: HintNotice | null;
  /** Called after the hint's "Take back" button is used. */
  onHintDone?: () => void;
  /** Under the board once solved, beside the cheer (e.g. the streak). */
  solvedExtra?: ReactNode;
};

export default function GameBoard({
  overlay,
  hintPlacement,
  hintNotice,
  onHintDone,
  solvedExtra,
}: GameBoardProps) {
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
    takeBack,
    feedback,
  } = useGame();
  const [winnerMessage] = useState(getRandomWinnerMessage());
  const instructionsId = useId();
  const shapeId = useId();
  const [cursor, setCursor] = useState(0);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  // The square under a mouse pointer, for the placement outline.
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  // The feedback message current when the hint notice arrived: a newer one
  // (e.g. a failed tap) replaces the notice in the message line.
  const [feedbackAtHint, setFeedbackAtHint] = useState<number | undefined>();
  useEffect(() => {
    setFeedbackAtHint(feedback?.sequence);
    // Only when a new notice arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintNotice?.sequence]);
  const showHintNotice =
    hintNotice && !solved && feedback?.sequence === feedbackAtHint;
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
  const squareAt = (index: number) => ({
    x: index % board.size.cols,
    y: Math.floor(index / board.size.cols),
  });
  // Where the selected piece would go for a square: the hint's spot when
  // the square is one the hint outlines, else covering that square.
  const placementFor = (index: number) => {
    if (!selectedTransform) return null;
    const square = squareAt(index);
    if (
      activeHint &&
      selectedTransform.cells.some(
        (part) =>
          activeHint.origin.x + part.x === square.x &&
          activeHint.origin.y + part.y === square.y,
      )
    )
      return {
        origin: activeHint.origin,
        valid: canPlace(board, selectedTransform, activeHint.origin),
      };
    return placementCovering(board, selectedTransform, square);
  };
  const hoverFree =
    hoverCell !== null && (!board.cells[hoverCell] || board.cells[hoverCell] === "blocker");
  const preview = draggingPieceId
    ? ghost
    : hoverFree && selectedTransform
      ? placementFor(hoverCell!)
      : keyboardFocus && selectedTransform
        ? placementFor(cursor)
        : activeHint && selectedTransform
          ? {
              origin: activeHint.origin,
              valid: canPlace(board, selectedTransform, activeHint.origin),
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
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHoverCell(index);
        }}
        onFocus={(event) => {
          setCursor(index);
          setKeyboardFocus(event.currentTarget.matches(":focus-visible"));
        }}
        style={
          {
            "--row": Math.floor(index / board.size.cols),
            ...(isPiece
              ? { "--block-color": PIECE_COLORS[cell as PieceId] }
              : null),
          } as CSSProperties
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
        squares. Enter or Space places the selected piece so it covers the
        current square. Delete or Backspace removes a piece. D rotates one
        way, S the other; F flips. Escape cancels selection.
      </p>
      <p className="sr-only" id={shapeId}>
        {selectedTransform && activePiece
          ? `${activePiece.name}: ${selectedTransform.width} columns by ${selectedTransform.height} rows, ${selectedTransform.cells.length} squares.`
          : "No piece selected."}
      </p>
      <div className={`board-shell${solved ? " solved" : ""}`}>
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
                activeHint,
              );
            }
          }}
          onPointerDown={readOnly ? undefined : onBoardPointerDown}
          onClick={
            readOnly ? undefined : (event) => onBoardClick(event, activeHint)
          }
          onPointerLeave={() => setHoverCell(null)}
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
              className={[
                "ghost",
                preview.valid ? null : "invalid",
                draggingPieceId ? null : "outline",
              ]
                .filter(Boolean)
                .join(" ")}
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
          <div className="celebration" aria-hidden="true">
            <WinnerFireworks className="celebration-fireworks" />
          </div>
        )}
      </div>
      <div className="board-guidance">
        {solved ? (
          <div className="solved-banner" role="status">
            <strong>Skål! Puzzle complete.</strong>
            <span>{winnerMessage}</span>
            {solvedExtra}
          </div>
        ) : (
          <div
            className={`board-feedback${feedback?.error && !showHintNotice ? " error" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {showHintNotice ? (
              <span key={`hint-${hintNotice.sequence}`}>
                {hintNotice.text}{" "}
                {hintNotice.takeBack && board.placements[hintNotice.takeBack] && (
                  <button
                    type="button"
                    className="inline-action"
                    onClick={() => {
                      takeBack(hintNotice.takeBack!);
                      onHintDone?.();
                    }}
                  >
                    Take back the{" "}
                    {PIECES.find((piece) => piece.id === hintNotice.takeBack)?.name}
                  </button>
                )}
              </span>
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
              `${activePiece.name} selected. Tap the board to place it; Rotate or Flip to fit.`
            ) : Object.values(board.placements).filter(Boolean).length > 0 ? (
              "To take a piece back, tap it in the tray. Undo works too."
            ) : (
              <>
                Pick a piece, then tap where it goes.{" "}
                <button
                  type="button"
                  className="inline-action"
                  onClick={() => window.dispatchEvent(new Event(OPEN_HELP_EVENT))}
                >
                  How to play
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
