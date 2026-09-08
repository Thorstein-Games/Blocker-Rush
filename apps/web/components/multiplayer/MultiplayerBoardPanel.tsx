"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
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

const EMPTY_PLACEMENTS: Record<PieceId, Placement | undefined> = {
  p1: undefined,
  p2: undefined,
  p3: undefined,
  p4: undefined,
  p5: undefined,
  p6: undefined,
  p7: undefined,
  p8: undefined,
  p9: undefined,
};

type MultiplayerBoardInnerProps = {
  selfPlayer?: TrackedPlayer;
  active: boolean;
  boardOverlay?: ReactNode;
  onPlace: (input: {
    roundIndex: number;
    pieceId: string;
    transformId: string;
    x: number;
    y: number;
  }) => void;
  onRemove: (input: { roundIndex: number; pieceId: string }) => void;
  onSubmitFinish: (roundIndex: number) => void;
  authoritativeReject?: {
    roundIndex: number;
    placedPieces: PiecePlacement[];
  };
};

function MultiplayerBoardInner({
  selfPlayer,
  active,
  boardOverlay,
  onPlace,
  onRemove,
  onSubmitFinish,
  authoritativeReject,
}: MultiplayerBoardInnerProps) {
  const { board, applyPuzzle, restoreState, solved, readOnly } = useGame();

  const round = selfPlayer?.round;
  const roundIndex = selfPlayer?.currentRoundIndex ?? 0;
  const roundPuzzleId = round?.puzzleId ?? "";
  const roundStartedAt = round?.startedAt;
  const roundPlacedPieces = round?.placedPieces ?? [];

  const blockers = useMemo(() => {
    if (!roundPuzzleId) return [];
    const record = getPuzzleById(roundPuzzleId);
    if (record) return record.blockers;
    try {
      return parsePuzzleId(roundPuzzleId);
    } catch {
      return [];
    }
  }, [roundPuzzleId]);

  const syncedRef = useRef(false);
  const suppressDiffRef = useRef(false);
  const prevPlacementsRef = useRef(board.placements);
  const submittedRoundsRef = useRef(new Set<number>());
  const applyPuzzleRef = useRef(applyPuzzle);
  const restoreStateRef = useRef(restoreState);
  const appliedRoundKeyRef = useRef<string | null>(null);
  const restoredRoundStateKeyRef = useRef<string | null>(null);
  const restoredRejectKeyRef = useRef<string | null>(null);

  useEffect(() => {
    applyPuzzleRef.current = applyPuzzle;
  }, [applyPuzzle]);

  useEffect(() => {
    restoreStateRef.current = restoreState;
  }, [restoreState]);

  const placedPiecesKey = useMemo(
    () =>
      roundPlacedPieces
        .map(
          (piece) =>
            `${piece.pieceId}:${piece.transformId}:${piece.x}:${piece.y}`,
        )
        .sort()
        .join("|"),
    [roundPlacedPieces],
  );

  const roundSyncKey = useMemo(() => {
    if (!roundPuzzleId) return "";
    return `${roundIndex}:${roundPuzzleId}:${roundStartedAt ?? ""}`;
  }, [roundIndex, roundPuzzleId, roundStartedAt]);

  const roundStateKey = useMemo(() => {
    if (!roundSyncKey) return "";
    return `${roundSyncKey}:${placedPiecesKey}`;
  }, [placedPiecesKey, roundSyncKey]);

  useEffect(() => {
    if (!roundSyncKey || blockers.length === 0) return;
    if (appliedRoundKeyRef.current === roundSyncKey) return;

    applyPuzzleRef.current({
      id: roundPuzzleId,
      blockers,
      difficulty: null,
    });

    appliedRoundKeyRef.current = roundSyncKey;
    suppressDiffRef.current = true;
    syncedRef.current = false;
    prevPlacementsRef.current = EMPTY_PLACEMENTS;
    restoredRejectKeyRef.current = null;
  }, [blockers, roundPuzzleId, roundSyncKey]);

  useEffect(() => {
    if (!roundStateKey) return;
    if (restoredRoundStateKeyRef.current === roundStateKey) return;

    // Acknowledging the same local placement must not erase Undo history.
    const localKey = Object.values(prevPlacementsRef.current)
      .filter((piece): piece is Placement => Boolean(piece))
      .map(
        (piece) =>
          `${piece.pieceId}:${piece.transformId}:${piece.origin.x}:${piece.origin.y}`,
      )
      .sort()
      .join("|");
    if (syncedRef.current && localKey === placedPiecesKey) {
      restoredRoundStateKeyRef.current = roundStateKey;
      return;
    }
    restoreStateRef.current({
      placements: roundPlacedPieces.map(toPlacement),
      pieceStates: buildPieceStates(roundPlacedPieces),
      blockers,
      startedAt: roundStartedAt,
    });
    restoredRoundStateKeyRef.current = roundStateKey;
    suppressDiffRef.current = true;
    syncedRef.current = true;
  }, [
    blockers,
    placedPiecesKey,
    roundPlacedPieces,
    roundStartedAt,
    roundStateKey,
  ]);

  useEffect(() => {
    if (!authoritativeReject) return;
    if (authoritativeReject.roundIndex !== roundIndex) return;
    const rejectKey = `${authoritativeReject.roundIndex}:${authoritativeReject.placedPieces
      .map(
        (piece) =>
          `${piece.pieceId}:${piece.transformId}:${piece.x}:${piece.y}`,
      )
      .sort()
      .join("|")}`;
    if (restoredRejectKeyRef.current === rejectKey) return;

    restoreStateRef.current({
      placements: authoritativeReject.placedPieces.map(toPlacement),
      pieceStates: buildPieceStates(authoritativeReject.placedPieces),
      blockers,
      startedAt: roundStartedAt,
    });
    restoredRejectKeyRef.current = rejectKey;
    suppressDiffRef.current = true;
  }, [authoritativeReject, blockers, roundIndex, roundStartedAt]);

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
  }, [
    active,
    board.placements,
    onPlace,
    onRemove,
    readOnly,
    roundIndex,
    selfPlayer,
  ]);

  useEffect(() => {
    if (!selfPlayer || !active || !round) return;
    if (!solved) return;
    if (submittedRoundsRef.current.has(round.roundIndex)) return;
    submittedRoundsRef.current.add(round.roundIndex);
    onSubmitFinish(round.roundIndex);
  }, [active, onSubmitFinish, round, selfPlayer, solved]);

  return (
    <>
      <GameBoard overlay={boardOverlay} />
      <PiecesTray />
    </>
  );
}

type MultiplayerBoardPanelProps = {
  selfPlayer?: TrackedPlayer;
  active: boolean;
  boardOverlay?: ReactNode;
  onPlace: MultiplayerBoardInnerProps["onPlace"];
  onRemove: MultiplayerBoardInnerProps["onRemove"];
  onSubmitFinish: MultiplayerBoardInnerProps["onSubmitFinish"];
  authoritativeReject?: MultiplayerBoardInnerProps["authoritativeReject"];
};

export default function MultiplayerBoardPanel(
  props: MultiplayerBoardPanelProps,
) {
  return (
    <GameProvider disabled={!props.active}>
      <MultiplayerBoardInner {...props} />
    </GameProvider>
  );
}
