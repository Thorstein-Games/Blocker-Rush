// Pure state transitions for server messages on the `blocker_rush` room.
// useMultiplayerSocket wires each ServerMessages type to one of these via
// setState; side effects (clientSeq bookkeeping) stay in the hook.
import type { ServerMessages } from "@blocker-rush/protocol";
import type { MultiplayerState, RoundSnapshot, TrackedPlayer } from "./multiplayerTypes";

type Reducer<K extends keyof ServerMessages> = (
  prev: MultiplayerState,
  data: ServerMessages[K],
) => MultiplayerState;

export const applyMatchStart: Reducer<"match_start"> = (prev, data) => ({
  ...prev,
  match: {
    matchId: data.matchId,
    startTime: data.startTime,
    countdownMs: data.countdownMs,
    rounds: data.rounds,
  },
  result: undefined,
});

export const applyRoundStart: Reducer<"round_start"> = (prev, data) => {
  const player = prev.players[data.playerId];
  const nextRound: RoundSnapshot = {
    roundIndex: data.roundIndex,
    puzzleId: data.puzzleId,
    startedAt: data.startTime,
    placedPieces: [],
    remainingPieceIds: [],
    boardFilledCount: 0,
  };
  return {
    ...prev,
    players: {
      ...prev.players,
      [data.playerId]: player
        ? { ...player, currentRoundIndex: data.roundIndex, round: nextRound }
        : {
            playerId: data.playerId,
            name: data.playerId,
            connected: true,
            ready: false,
            currentRoundIndex: data.roundIndex,
            splitsMs: [],
            lastAppliedSeq: 0,
            round: nextRound,
          },
    },
  };
};

export const applyPlayerState: Reducer<"player_state"> = (prev, data) => {
  const player = prev.players[data.playerId];
  const roundIndex = data.roundIndex;
  const roundDef = prev.match?.rounds.find((r) => r.roundIndex === roundIndex);
  const sameRound = player?.round?.roundIndex === roundIndex;
  return {
    ...prev,
    players: {
      ...prev.players,
      [data.playerId]: {
        playerId: data.playerId,
        name: player?.name ?? data.playerId,
        connected: player?.connected ?? true,
        ready: player?.ready ?? false,
        currentRoundIndex: roundIndex,
        splitsMs: player?.splitsMs ?? [],
        lastAppliedSeq: data.lastAppliedSeq,
        round: {
          roundIndex,
          puzzleId: sameRound && player?.round ? player.round.puzzleId : (roundDef?.puzzleId ?? ""),
          startedAt: sameRound && player?.round ? player.round.startedAt : (player?.round?.startedAt ?? 0),
          finishedAt: data.finishedAt,
          splitMs: data.splitMs,
          placedPieces: data.placedPieces,
          remainingPieceIds: data.remainingPieceIds,
          boardFilledCount: data.boardFilledCount,
        },
      },
    },
  };
};

export const applyActionRejected: Reducer<"action_rejected"> = (prev, data) => ({
  ...prev,
  lastRejected: {
    clientSeq: data.clientSeq,
    reason: data.reason,
    authoritativeState: data.authoritativeState,
  },
});

export const applyPlayerFinished: Reducer<"player_finished"> = (prev, data) => {
  const player = prev.players[data.playerId];
  if (!player) return prev;
  const splits = [...player.splitsMs];
  splits[data.roundIndex] = data.splitMs;
  return {
    ...prev,
    players: {
      ...prev.players,
      [data.playerId]: {
        ...player,
        splitsMs: splits,
        round: player.round
          ? { ...player.round, finishedAt: data.finishedAt, splitMs: data.splitMs }
          : player.round,
      },
    },
  };
};

export const applyMatchResult: Reducer<"match_result"> = (prev, data) => ({
  ...prev,
  result: {
    state: "finished",
    winnerId: data.winnerId,
    placements: data.placements,
    splitsByPlayer: data.splitsByPlayer,
    winnerBoards: data.winnerBoards,
  },
});

export const applyStateSync = (
  prev: MultiplayerState,
  data: ServerMessages["state_sync"],
  receivedAt: number = Date.now(),
): MultiplayerState => {
  const players: Record<string, TrackedPlayer> = { ...prev.players };
  for (const p of data.players) {
    const previous = players[p.playerId];
    players[p.playerId] = {
      playerId: p.playerId,
      name: p.name,
      connected: previous?.connected ?? true,
      ready: previous?.ready ?? false,
      currentRoundIndex: p.currentRoundIndex,
      splitsMs: p.splitsMs,
      lastAppliedSeq: p.lastAppliedSeq,
      round: p.round
        ? {
            roundIndex: p.round.roundIndex,
            puzzleId: p.round.puzzleId,
            startedAt: p.round.startedAt,
            finishedAt: p.round.finishedAt,
            placedPieces: p.round.placedPieces,
            remainingPieceIds: p.round.remainingPieceIds,
            boardFilledCount: p.round.boardFilledCount,
          }
        : undefined,
    };
  }
  return {
    ...prev,
    players,
    match:
      data.matchId
        ? {
            matchId: data.matchId,
            startTime: data.matchStartedAt ?? prev.match?.startTime ?? 0,
            countdownMs: 0,
            rounds: data.rounds ?? prev.match?.rounds ?? [],
          }
        : prev.match,
    clockOffsetMs: data.now - receivedAt,
  };
};

export const applyError: Reducer<"error"> = (prev, data) => ({
  ...prev,
  error: data.message,
});

/** player_removed for *this* client (caller checks sessionId). */
export const applySelfRemoved: Reducer<"player_removed"> = (prev, data) => ({
  ...prev,
  roomCode: undefined,
  roomVisibility: undefined,
  status: undefined,
  hostId: undefined,
  selfPlayerId: undefined,
  players: {},
  match: undefined,
  result: undefined,
  // Unlike a dropped connection (see applyRoomLeft), this is
  // intentional/final - don't let the ?room=<code> auto-join effect
  // walk us right back into a room we were just kicked from.
  leftRoomCode: prev.roomCode ?? prev.leftRoomCode,
  error: data.reason === "kicked" ? "You were removed from the room." : prev.error,
});

/** Game-room connection dropped (room.onLeave). */
export const applyRoomLeft = (
  prev: MultiplayerState,
  lostAt: number = Date.now(),
): MultiplayerState => ({
  ...prev,
  connected: prev.connected, // lobby connection is independent
  lastConnectionLostAt: lostAt,
  reconnectRoomCode: prev.roomCode ?? prev.reconnectRoomCode,
  roomCode: undefined,
  roomVisibility: undefined,
  status: undefined,
  hostId: undefined,
  selfPlayerId: undefined,
  players: {},
  match: undefined,
  result: undefined,
});
