import { describe, expect, it } from "vitest";
import type { ServerMessages } from "@blocker-rush/protocol";
import {
  applyActionRejected,
  applyMatchResult,
  applyMatchStart,
  applyPlayerFinished,
  applyPlayerState,
  applyRoomLeft,
  applyRoundStart,
  applySelfRemoved,
  applyStateSync,
} from "./multiplayerReducers";
import { createInitialState, type MultiplayerState } from "./multiplayerTypes";

const placement = { pieceId: "p8" as const, transformId: "0,0|1,0|0,1|1,1", x: 0, y: 0 };

const inRoom = (): MultiplayerState => ({
  ...createInitialState(),
  roomCode: "ABCD",
  status: "in_game",
  hostId: "p1",
  selfPlayerId: "p1",
  players: {
    p1: {
      playerId: "p1",
      name: "Alice",
      connected: true,
      ready: true,
      currentRoundIndex: 0,
      splitsMs: [null, null],
      lastAppliedSeq: 0,
    },
  },
  match: {
    matchId: "m_1",
    startTime: 1000,
    countdownMs: 3000,
    rounds: [
      { roundIndex: 0, difficulty: "easy", puzzleId: "A2A4D1D2F4F5F6" },
      { roundIndex: 1, difficulty: "medium", puzzleId: "A3C3C4D1F1F5F6" },
    ],
  },
});

const playerState = (
  overrides: Partial<ServerMessages["player_state"]> = {},
): ServerMessages["player_state"] => ({
  matchId: "m_1",
  playerId: "p1",
  roundIndex: 0,
  placedPieces: [placement],
  remainingPieceIds: ["p1", "p2"],
  boardFilledCount: 11,
  lastAppliedSeq: 3,
  ...overrides,
});

describe("multiplayer reducers", () => {
  it("match_start sets the match and clears a previous result", () => {
    const prev = { ...inRoom(), result: { state: "finished" as const, winnerId: "x", placements: [], splitsByPlayer: {}, winnerBoards: [] } };
    const next = applyMatchStart(prev, { matchId: "m_2", startTime: 5, countdownMs: 3000, rounds: [] });
    expect(next.match).toEqual({ matchId: "m_2", startTime: 5, countdownMs: 3000, rounds: [] });
    expect(next.result).toBeUndefined();
  });

  it("round_start resets the round for known and unknown players", () => {
    const msg = { roundIndex: 1, puzzleId: "A3C3C4D1F1F5F6", startTime: 42 };
    const known = applyRoundStart(inRoom(), { ...msg, playerId: "p1" });
    expect(known.players.p1).toMatchObject({ name: "Alice", currentRoundIndex: 1 });
    expect(known.players.p1!.round).toEqual({
      roundIndex: 1,
      puzzleId: "A3C3C4D1F1F5F6",
      startedAt: 42,
      placedPieces: [],
      remainingPieceIds: [],
      boardFilledCount: 0,
    });

    const unknown = applyRoundStart(inRoom(), { ...msg, playerId: "p9" });
    expect(unknown.players.p9).toMatchObject({ playerId: "p9", name: "p9", connected: true });
  });

  it("player_state keeps puzzle/start time within a round and falls back to the round def", () => {
    const started = applyRoundStart(inRoom(), {
      playerId: "p1",
      roundIndex: 0,
      puzzleId: "A2A4D1D2F4F5F6",
      startTime: 77,
    });
    const next = applyPlayerState(started, playerState());
    expect(next.players.p1!.round).toMatchObject({
      puzzleId: "A2A4D1D2F4F5F6",
      startedAt: 77,
      placedPieces: [placement],
      boardFilledCount: 11,
    });
    expect(next.players.p1!.lastAppliedSeq).toBe(3);

    // Advanced to a round we haven't seen round_start for: puzzle from match.rounds.
    const advanced = applyPlayerState(started, playerState({ roundIndex: 1 }));
    expect(advanced.players.p1!.round!.puzzleId).toBe("A3C3C4D1F1F5F6");
  });

  it("action_rejected records the rejection", () => {
    const next = applyActionRejected(inRoom(), {
      matchId: "m_1",
      clientSeq: 4,
      reason: "collision",
      authoritativeState: { roundIndex: 0, placedPieces: [], remainingPieceIds: [], lastAppliedSeq: 3 },
    });
    expect(next.lastRejected).toMatchObject({ clientSeq: 4, reason: "collision" });
  });

  it("player_finished records the split and ignores unknown players", () => {
    const next = applyPlayerFinished(inRoom(), { playerId: "p1", roundIndex: 1, finishedAt: 9, splitMs: 1234 });
    expect(next.players.p1!.splitsMs).toEqual([null, 1234]);
    const prev = inRoom();
    expect(applyPlayerFinished(prev, { playerId: "nope", roundIndex: 0, finishedAt: 9, splitMs: 1 })).toBe(prev);
  });

  it("match_result stores the result", () => {
    const next = applyMatchResult(inRoom(), {
      matchId: "m_1",
      winnerId: "p1",
      placements: [{ playerId: "p1", place: 1, roundsCompleted: 2, status: "finished" }],
      splitsByPlayer: { p1: [1, 2] },
      winnerBoards: [],
    });
    expect(next.result).toMatchObject({ state: "finished", winnerId: "p1" });
  });

  it("state_sync rebuilds players, match and clock offset", () => {
    const next = applyStateSync(
      { ...createInitialState(), players: {} },
      {
        now: 10_500,
        status: "in_game",
        settings: createInitialState().settings,
        matchId: "m_1",
        matchStartedAt: 900,
        rounds: inRoom().match!.rounds,
        players: [
          {
            playerId: "p1",
            name: "Alice",
            currentRoundIndex: 0,
            splitsMs: [null],
            lastAppliedSeq: 5,
            round: {
              roundIndex: 0,
              puzzleId: "A2A4D1D2F4F5F6",
              startedAt: 900,
              placedPieces: [placement],
              remainingPieceIds: [],
              boardFilledCount: 4,
            },
          },
        ],
      },
      10_000,
    );
    expect(next.clockOffsetMs).toBe(500);
    expect(next.match).toMatchObject({ matchId: "m_1", startTime: 900, countdownMs: 0 });
    expect(next.players.p1).toMatchObject({ name: "Alice", lastAppliedSeq: 5, connected: true });
    expect(next.players.p1!.round!.placedPieces).toEqual([placement]);
  });

  it("self-removal clears the room and blocks auto-rejoin; kick sets an error", () => {
    const kicked = applySelfRemoved(inRoom(), { sessionId: "p1", reason: "kicked" });
    expect(kicked).toMatchObject({ roomCode: undefined, players: {}, leftRoomCode: "ABCD" });
    expect(kicked.error).toMatch(/removed/);
    expect(applySelfRemoved(inRoom(), { sessionId: "p1", reason: "left" }).error).toBeUndefined();
  });

  it("room leave keeps the code for reconnection", () => {
    const next = applyRoomLeft(inRoom(), 123);
    expect(next).toMatchObject({
      roomCode: undefined,
      reconnectRoomCode: "ABCD",
      lastConnectionLostAt: 123,
      players: {},
    });
    expect(next.leftRoomCode).toBeUndefined();
  });
});
