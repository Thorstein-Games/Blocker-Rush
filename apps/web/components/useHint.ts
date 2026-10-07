"use client";

import { useEffect, useRef, useState } from "react";
import { PIECES, findHint, type Placement } from "@blocker-rush/shared";
import { useGame } from "./GameContext";
import { findOrientationForTransform } from "./pieceGeometry";

const pieceName = (pieceId: string) =>
  PIECES.find((piece) => piece.id === pieceId)?.name ?? "That piece";

const MESSAGE_MS = 8000;

/**
 * Hints for the single-player board in GameContext. A hint is worked out
 * from the player's current pieces (see findHint), so it never points at
 * squares they've already filled; if their pieces can't lead to a solution
 * it says which one to take back.
 */
export function useHint() {
  const { puzzleId, blockers, board, readOnly, setPieceState, selectPiece, boardRef } =
    useGame();
  const [message, setMessage] = useState<string | null>(null);
  const [hintPlacement, setHintPlacement] = useState<Placement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearHint = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setMessage(null);
    setHintPlacement(null);
  };

  useEffect(() => clearHint, []);
  useEffect(clearHint, [puzzleId]);

  const show = (text: string) => {
    setMessage(text);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setMessage(null), MESSAGE_MS);
  };

  /** Shows the next hint. Returns false if there was nothing to hint. */
  const requestHint = (): boolean => {
    if (!puzzleId || readOnly) return false;
    const hint = findHint(blockers, board.placements);
    switch (hint.kind) {
      case "place": {
        const { placement } = hint;
        setHintPlacement(placement);
        setPieceState(
          placement.pieceId,
          findOrientationForTransform(placement.pieceId, placement.transformId),
        );
        selectPiece(placement.pieceId);
        // GameBoard outlines the squares and says which piece goes there.
        setMessage(null);
        window.requestAnimationFrame(() => {
          boardRef.current
            ?.querySelector<HTMLElement>(
              `[data-index="${placement.origin.y * board.size.cols + placement.origin.x}"]`,
            )
            ?.focus();
        });
        return true;
      }
      case "remove":
        setHintPlacement(null);
        show(
          `The ${pieceName(hint.pieceId)} can't stay where it is. Double-tap it to take it back.`,
        );
        return true;
      case "restart":
        setHintPlacement(null);
        show("These pieces can't all stay where they are. Try clearing the board.");
        return true;
      case "solved":
        show("All pieces are already placed.");
        return false;
      case "unsolvable":
        show("No hints are available for this puzzle.");
        return false;
    }
  };

  return { hintMessage: message, hintPlacement, requestHint, clearHint };
}
