"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PieceId, Placement } from "@blocker-rush/shared";
import { getPuzzleById, parsePuzzleId } from "@blocker-rush/shared";
import type { PiecePlacement } from "@blocker-rush/protocol";
import GameBoard from "../GameBoard";
import {
  GameProvider,
  findOrientationForTransform,
  useGame,
} from "../GameContext";
import PiecesTray from "../PiecesTray";
import type { PieceState } from "../gameTypes";
import { diffPlacements } from "./reconcile";
import type { TrackedPlayer } from "./useMultiplayerSocket";

const toPlacement = (piece: PiecePlacement): Placement => ({
  pieceId: piece.pieceId,
  transformId: piece.transformId,
  origin: { x: piece.x, y: piece.y },
});

const buildPieceStates = (
  pieces: PiecePlacement[],
): Record<PieceId, PieceState> => {
  const base: Record<PieceId, PieceState> = {
    p1: { rotation: 0, flipped: false },
    p2: { rotation: 0, flipped: false },
    p3: { rotation: 0, flipped: false },
    p4: { rotation: 0, flipped: false },
    p5: { rotation: 0, flipped: false },
    p6: { rotation: 0, flipped: false },
    p7: { rotation: 0, flipped: false },
    p8: { rotation: 0, flipped: false },
    p9: { rotation: 0, flipped: false },
  };

  for (const piece of pieces) {
    base[piece.pieceId] = findOrientationForTransform(
      piece.pieceId,
      piece.transformId,
    );
  }

  return base;
};

type MultiplayerBoardInnerProps = {
  selfPlayer?: TrackedPlayer;
  active: boolean;
  onPlace: (input: {
    roundIndex: number;
    pieceId: string;
    transformId: string;
    x: number;
    y: number;
  }) => void;
  onRemove: (input: { roundIndex: number; pieceId: string }) => void;
  onUndo: (roundIndex: number) => void;
  onSubmitFinish: (roundIndex: number) => void;
  authoritativeReject?: {
    roundIndex: number;
    placedPieces: PiecePlacement[];
  };
};

function MultiplayerBoardInner({
  selfPlayer,
  active,
  onPlace,
  onRemove,
  onUndo,
  onSubmitFinish,
  authoritativeReject,
}: MultiplayerBoardInnerProps) {
  const {
    board,
    applyPuzzle,
    restoreState,
    solved,
    readOnly,
  } = useGame();

  const round = selfPlayer?.round;
  const roundIndex = selfPlayer?.currentRoundIndex ?? 0;

  const puzzleId = round?.puzzleId ?? "";
  const blockers = useMemo(() => {
    if (!puzzleId) return [];
    const record = getPuzzleById(puzzleId);
    if (record) return record.blockers;
    try {
      return parsePuzzleId(puzzleId);
    } catch {
      return [];
    }
  }, [puzzleId]);

  const syncedRef = useRef(false);
  const suppressDiffRef = useRef(false);
  const prevPlacementsRef = useRef(board.placements);
  const submittedRoundsRef = useRef(new Set<number>());

  useEffect(() => {
    if (!round || blockers.length === 0) return;

    applyPuzzle({
      id: round.puzzleId,
      blockers,
      difficulty: null,
    });

    suppressDiffRef.current = true;
    syncedRef.current = false;
  }, [applyPuzzle, round?.puzzleId, blockers, round]);

  useEffect(() => {
    if (!round) return;
    if (!round.puzzleId) return;

    restoreState({
      placements: round.placedPieces.map(toPlacement),
      pieceStates: buildPieceStates(round.placedPieces),
      blockers,
      startedAt: round.startedAt,
    });
    suppressDiffRef.current = true;
    syncedRef.current = true;
  }, [restoreState, round, blockers]);

  useEffect(() => {
    if (!authoritativeReject) return;
    if (authoritativeReject.roundIndex !== roundIndex) return;

    restoreState({
      placements: authoritativeReject.placedPieces.map(toPlacement),
      pieceStates: buildPieceStates(authoritativeReject.placedPieces),
      blockers,
      startedAt: round?.startedAt,
    });
    suppressDiffRef.current = true;
  }, [authoritativeReject, roundIndex, restoreState, blockers, round?.startedAt]);

  useEffect(() => {
    const previous = prevPlacementsRef.current;
    const current = board.placements;

    if (!selfPlayer || !active || readOnly || !syncedRef.current) {
      prevPlacementsRef.current = current;
      return;
    }

    if (suppressDiffRef.current) {
      suppressDiffRef.current = false;
      prevPlacementsRef.current = current;
      return;
    }

    const diff = diffPlacements(previous, current);

    for (const pieceId of diff.removed) {
      onRemove({ roundIndex, pieceId });
    }

    for (const item of diff.added) {
      onPlace({
        roundIndex,
        pieceId: item.pieceId,
        transformId: item.placement.transformId,
        x: item.placement.origin.x,
        y: item.placement.origin.y,
      });
    }

    for (const item of diff.moved) {
      onRemove({ roundIndex, pieceId: item.pieceId });
      onPlace({
        roundIndex,
        pieceId: item.pieceId,
        transformId: item.placement.transformId,
        x: item.placement.origin.x,
        y: item.placement.origin.y,
      });
    }

    prevPlacementsRef.current = current;
  }, [active, board.placements, onPlace, onRemove, readOnly, roundIndex, selfPlayer]);

  useEffect(() => {
    if (!selfPlayer || !active || !round) return;
    if (!solved) return;
    if (submittedRoundsRef.current.has(round.roundIndex)) return;
    submittedRoundsRef.current.add(round.roundIndex);
    onSubmitFinish(round.roundIndex);
  }, [active, onSubmitFinish, round, selfPlayer, solved]);

  return (
    <>
      <div className="multiplayer-board-controls">
        <button
          className="button secondary"
          type="button"
          onClick={() => onUndo(roundIndex)}
          disabled={!active}
        >
          Undo
        </button>
        <span className="status-row">
          Round {roundIndex + 1} · {active ? "Live" : "Locked"}
        </span>
      </div>
      <GameBoard />
      <PiecesTray />
    </>
  );
}

type MultiplayerBoardPanelProps = {
  selfPlayer?: TrackedPlayer;
  active: boolean;
  onPlace: MultiplayerBoardInnerProps["onPlace"];
  onRemove: MultiplayerBoardInnerProps["onRemove"];
  onUndo: MultiplayerBoardInnerProps["onUndo"];
  onSubmitFinish: MultiplayerBoardInnerProps["onSubmitFinish"];
  authoritativeReject?: MultiplayerBoardInnerProps["authoritativeReject"];
};

export default function MultiplayerBoardPanel(props: MultiplayerBoardPanelProps) {
  return (
    <GameProvider>
      <MultiplayerBoardInner {...props} />
    </GameProvider>
  );
}
