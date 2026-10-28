"use client";

import { useEffect, useRef, useState } from "react";
import {
  PIECES,
  PIECE_TRANSFORMS,
  findHint,
  type PieceId,
  type Placement,
} from "@blocker-rush/shared";
import { useGame } from "./GameContext";
import { findOrientationForTransform } from "./pieceGeometry";

const pieceName = (pieceId: string) =>
  PIECES.find((piece) => piece.id === pieceId)?.name ?? "That piece";

const MESSAGE_MS = 8000;

/** A hint shown in words: GameBoard puts it under the board. */
export type HintNotice = {
  text: string;
  /** A piece to offer a "Take back" button for. */
  takeBack?: PieceId;
  sequence: number;
};

/**
 * Hints for the single-player board in GameContext. A hint is worked out
 * from the player's current pieces (see findHint), so it never points at
 * squares they've already filled; if their pieces can't lead to a solution
 * it says which one to take back.
 */
export function useHint() {
  const { puzzleId, blockers, board, readOnly, setPieceState, selectPiece, boardRef } =
    useGame();
  const [message, setMessage] = useState<HintNotice | null>(null);
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

  const show = (text: string, takeBack?: PieceId) => {
    setMessage((previous) => ({
      text,
      takeBack,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
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
        // Focus a square the piece covers, so Enter places it there.
        const first = PIECE_TRANSFORMS[placement.pieceId]?.find(
          (transform) => transform.id === placement.transformId,
        )?.cells[0] ?? { x: 0, y: 0 };
        const square =
          (placement.origin.y + first.y) * board.size.cols +
          placement.origin.x +
          first.x;
        window.requestAnimationFrame(() => {
          boardRef.current
            ?.querySelector<HTMLElement>(`[data-index="${square}"]`)
            ?.focus();
        });
        return true;
      }
      case "remove":
        setHintPlacement(null);
        show(
          `Hint: the ${pieceName(hint.pieceId)} can't stay where it is.`,
          hint.pieceId,
        );
        return true;
      case "restart":
        setHintPlacement(null);
        show("Hint: these pieces can't all stay where they are. Try Clear.");
        return true;
      case "solved":
        show("Every piece is already placed.");
        return false;
      case "unsolvable":
        show("No hints are available for this puzzle.");
        return false;
    }
  };

  return { hintMessage: message, hintPlacement, requestHint, clearHint };
}
