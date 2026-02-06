import assert from "node:assert/strict";
import test from "node:test";
import { getPuzzlesForDifficulty, solvePuzzle } from "@blocker-rush/shared";
import type { BoardCell } from "@blocker-rush/shared";
import {
  applyFinish,
  applyPlacePiece,
  applyRemovePiece,
  applyUndo,
  buildRoundStates,
  finalizePlacements,
  tryAdvancePlayer,
  validateAndApplySeq,
} from "../domain/match-engine";
import { RoomManager } from "../domain/rooms";

const makeSocket = (id: string): { id: string } => ({ id });

test("validateAndApplySeq rejects duplicate and out-of-order seq", () => {
  const puzzle = getPuzzlesForDifficulty("easy")[0];
  assert.ok(puzzle);

  const player = {
    playerId: "u1",
    name: "A",
    connected: true,
    resumeToken: "token",
    currentRoundIndex: 0,
    completedFinal: false,
    splitsMs: [null],
    lastProcessedSeq: 0,
    rounds: buildRoundStates(
      [{ roundIndex: 0, difficulty: "easy", puzzleId: puzzle.id }],
      Date.now(),
    ),
    ready: false,
  };

  assert.equal(validateAndApplySeq(player, 1), null);
  assert.equal(player.lastProcessedSeq, 1);
  assert.equal(validateAndApplySeq(player, 1), "duplicate_seq");
  assert.equal(validateAndApplySeq(player, 3), "out_of_order_seq");
  assert.equal(player.lastProcessedSeq, 1);
});

test("applyPlace/remove/undo stays deterministic", () => {
  const puzzle = getPuzzlesForDifficulty("easy")[0];
  assert.ok(puzzle);

  const solution = solvePuzzle(puzzle.blockers, { maxSolutions: 1 }).firstSolution;
  assert.ok(solution);

  const firstPlacement = Object.values(solution).find(Boolean);
  assert.ok(firstPlacement);

  const player = {
    playerId: "u1",
    name: "A",
    connected: true,
    resumeToken: "token",
    currentRoundIndex: 0,
    completedFinal: false,
    splitsMs: [null],
    lastProcessedSeq: 1,
    rounds: buildRoundStates(
      [{ roundIndex: 0, difficulty: "easy", puzzleId: puzzle.id }],
      Date.now(),
    ),
    ready: false,
  };

  const placed = applyPlacePiece(
    player,
    {
      pieceId: firstPlacement.pieceId,
      transformId: firstPlacement.transformId,
      x: firstPlacement.origin.x,
      y: firstPlacement.origin.y,
    },
    1,
  );
  assert.equal(placed.ok, true);
  if (!placed.ok) return;

  const removed = applyRemovePiece(
    player,
    { pieceId: firstPlacement.pieceId },
    2,
  );
  assert.equal(removed.ok, true);

  const undo = applyUndo(player);
  assert.equal(undo.ok, true);
  if (!undo.ok) return;

  const restored = undo.round.placedPieces.find(
    (piece: { pieceId: string }) => piece.pieceId === firstPlacement.pieceId,
  );
  assert.ok(restored);
  assert.equal(restored?.transformId, firstPlacement.transformId);
  assert.equal(restored?.x, firstPlacement.origin.x);
  assert.equal(restored?.y, firstPlacement.origin.y);
});

test("rejoin within grace returns same player seat", () => {
  const manager = new RoomManager();
  const socketA = makeSocket("s1");
  const joined = manager.joinByRequest({
    socket: socketA,
    name: "Kai",
    queue: "public",
  });

  manager.markDisconnected("s1");

  const socketB = makeSocket("s2");
  const rejoined = manager.joinByRequest({
    socket: socketB,
    name: "Kai",
    roomCode: joined.room.roomCode,
    resumeToken: joined.player.resumeToken,
  });

  assert.equal(rejoined.player.playerId, joined.player.playerId);
  assert.equal(rejoined.player.connected, true);
});

test("round finish computes split and advances", () => {
  const puzzle = getPuzzlesForDifficulty("easy")[0];
  assert.ok(puzzle);

  const player = {
    playerId: "u1",
    name: "A",
    connected: true,
    resumeToken: "token",
    currentRoundIndex: 0,
    completedFinal: false,
    splitsMs: [null, null],
    lastProcessedSeq: 0,
    rounds: buildRoundStates(
      [
        { roundIndex: 0, difficulty: "easy", puzzleId: puzzle.id },
        { roundIndex: 1, difficulty: "easy", puzzleId: puzzle.id },
      ],
      1000,
    ),
    ready: false,
  };

  player.rounds[0]!.board.cells = player.rounds[0]!.board.cells.map(
    (cell: BoardCell) => (cell === null ? "p1" : cell),
  );

  const finish = applyFinish(player, 2300);
  assert.equal(finish.ok, true);
  if (!finish.ok) return;

  assert.equal(finish.splitMs, 1300);
  const nextRound = tryAdvancePlayer(player, 2300);
  assert.ok(nextRound);
  assert.equal(player.currentRoundIndex, 1);
  assert.equal(nextRound?.startedAt, 2300);
});

test("finalizePlacements ranks by completion then rounds", () => {
  const players = {
    a: {
      playerId: "a",
      name: "A",
      connected: true,
      resumeToken: "ra",
      currentRoundIndex: 2,
      completedFinal: true,
      finalFinishedAt: 3000,
      splitsMs: [1000, 1000, 1000],
      lastProcessedSeq: 1,
      rounds: {
        0: { finishedAt: 1 },
        1: { finishedAt: 1 },
        2: { finishedAt: 1 },
      },
      ready: false,
    },
    b: {
      playerId: "b",
      name: "B",
      connected: true,
      resumeToken: "rb",
      currentRoundIndex: 1,
      completedFinal: false,
      splitsMs: [1200, null, null],
      lastProcessedSeq: 1,
      rounds: {
        0: { finishedAt: 1 },
        1: {},
        2: {},
      },
      ready: false,
    },
  } as any;

  const result = finalizePlacements(players, "a");
  assert.equal(result.winnerId, "a");
  assert.equal(result.placements[0]?.playerId, "a");
  assert.equal(result.placements[1]?.status, "dnf");
});
