import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { pickPuzzleByDifficulty } from "@blocker-rush/shared";
import {
  MATCH_COUNTDOWN_MS,
  MAX_PLAYERS,
  SOCKET_EVENT_NAME,
  safeParseClientEvent,
  type ActionRejectedReason,
  type ServerEvent,
} from "@blocker-rush/protocol";
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
import { TokenBucket } from "../domain/rateLimiter";
import { RoomManager } from "../domain/rooms";
import type { InternalPlayerState, InternalRoom, RoundPuzzle } from "../domain/types";
import { clampLockInMs, countdownMs, createId, now } from "../domain/utils";

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const serializePlayerState = (room: InternalRoom, player: InternalPlayerState): ServerEvent => {
  const match = room.match;
  const round = player.rounds[player.currentRoundIndex];

  return {
    type: "playerState",
    data: {
      roomCode: room.roomCode,
      matchId: match?.matchId ?? "",
      playerId: player.playerId,
      roundIndex: player.currentRoundIndex,
      placedPieces: round?.placedPieces ?? [],
      remainingPieceIds: round?.remainingPieceIds ?? [],
      boardFilledCount: round?.boardFilledCount ?? 0,
      lastAppliedSeq: player.lastProcessedSeq,
      finishedAt: round?.finishedAt,
      splitMs: round?.splitMs,
    },
  };
};

const serializeRoomState = (
  room: InternalRoom,
  you?: InternalPlayerState,
): ServerEvent => ({
  type: "roomState",
  data: {
    roomCode: room.roomCode,
    players: Object.values(room.players).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      ready: player.ready,
    })),
    hostId: room.hostId,
    settings: room.settings,
    visibility: room.visibility,
    status: room.status,
    you: you
      ? {
          playerId: you.playerId,
          resumeToken: you.resumeToken,
        }
      : undefined,
  },
});

const serializeStateSync = (
  room: InternalRoom,
  you?: InternalPlayerState,
): ServerEvent => ({
  type: "stateSync",
  data: {
    roomCode: room.roomCode,
    now: now(),
    status: room.status,
    hostId: room.hostId,
    settings: room.settings,
    visibility: room.visibility,
    match: room.match
      ? {
          matchId: room.match.matchId,
          startedAt: room.match.startedAt,
          countdownStartAt: room.match.countdownStartAt,
          rounds: room.match.rounds,
          winnerId: room.match.winnerId,
          winnerDecidedAt: room.match.winnerDecidedAt,
          lockEndsAt: room.match.lockEndsAt,
        }
      : undefined,
    players: Object.values(room.players).map((player) => {
      const round = player.rounds[player.currentRoundIndex];
      return {
        playerId: player.playerId,
        name: player.name,
        connected: player.connected,
        currentRoundIndex: player.currentRoundIndex,
        splitsMs: player.splitsMs,
        lastAppliedSeq: player.lastProcessedSeq,
        round: round
          ? {
              roundIndex: round.roundIndex,
              puzzleId: round.puzzleId,
              startedAt: round.startedAt,
              finishedAt: round.finishedAt,
              placedPieces: round.placedPieces,
              remainingPieceIds: round.remainingPieceIds,
              boardFilledCount: round.boardFilledCount,
            }
          : undefined,
      };
    }),
    you: you
      ? {
          playerId: you.playerId,
          resumeToken: you.resumeToken,
        }
      : undefined,
  },
});

const serializeLobbyState = (rooms: ReturnType<RoomManager["listLobbyRooms"]>): ServerEvent => ({
  type: "lobbyState",
  data: {
    rooms,
  },
});

const serializeActionRejected = (args: {
  room: InternalRoom;
  clientSeq: number;
  reason: ActionRejectedReason;
  player: InternalPlayerState;
}): ServerEvent => {
  const round = args.player.rounds[args.player.currentRoundIndex];
  return {
    type: "actionRejected",
    data: {
      roomCode: args.room.roomCode,
      matchId: args.room.match?.matchId ?? "",
      clientSeq: args.clientSeq,
      reason: args.reason,
      authoritativeState: round
        ? {
            roundIndex: round.roundIndex,
            placedPieces: round.placedPieces,
            remainingPieceIds: round.remainingPieceIds,
            lastAppliedSeq: args.player.lastProcessedSeq,
          }
        : undefined,
    },
  };
};

export const createSocketGateway = (port: number) => {
  const roomManager = new RoomManager();
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const rateLimiterBySocket = new Map<string, TokenBucket>();

  const emitEvent = (socket: Socket, event: ServerEvent) => {
    socket.emit(SOCKET_EVENT_NAME, event);
  };

  const emitToRoom = (roomCode: string, event: ServerEvent) => {
    io.to(roomCode).emit(SOCKET_EVENT_NAME, event);
  };

  const emitLobbyState = () => {
    io.emit(SOCKET_EVENT_NAME, serializeLobbyState(roomManager.listLobbyRooms()));
  };

  const emitRoomState = (room: InternalRoom) => {
    emitToRoom(room.roomCode, serializeRoomState(room));
  };

  const scheduleFinalize = (room: InternalRoom) => {
    if (!room.match?.lockEndsAt || !room.match.winnerId) return;

    if (room.match.finalizeTimerId) {
      clearTimeout(room.match.finalizeTimerId);
    }

    const delay = Math.max(0, room.match.lockEndsAt - now());
    room.match.finalizeTimerId = setTimeout(() => {
      const freshRoom = roomManager.getRoom(room.roomCode);
      if (!freshRoom?.match?.winnerId) return;
      if (freshRoom.status !== "winner_window") return;

      const result = finalizePlacements(freshRoom.players, freshRoom.match.winnerId);
      freshRoom.status = "finished";
      freshRoom.updatedAt = now();

      emitRoomState(freshRoom);
      emitToRoom(freshRoom.roomCode, {
        type: "matchResult",
        data: {
          roomCode: freshRoom.roomCode,
          matchId: freshRoom.match.matchId,
          winnerId: result.winnerId,
          placements: result.placements,
          splitsByPlayer: result.splitsByPlayer,
        },
      });
      emitLobbyState();
    }, delay);
  };

  const scheduleCountdown = (room: InternalRoom) => {
    if (!room.match) return;
    if (room.match.countdownTimerId) {
      clearTimeout(room.match.countdownTimerId);
    }

    const delay = Math.max(0, room.match.startedAt - now());
    room.match.countdownTimerId = setTimeout(() => {
      const freshRoom = roomManager.getRoom(room.roomCode);
      if (!freshRoom?.match) return;
      if (freshRoom.status !== "countdown") return;

      freshRoom.status = "in_game";
      freshRoom.updatedAt = now();
      emitRoomState(freshRoom);

      for (const player of Object.values(freshRoom.players)) {
        const round = player.rounds[player.currentRoundIndex];
        if (!round) continue;

        emitToRoom(freshRoom.roomCode, {
          type: "roundStart",
          data: {
            roomCode: freshRoom.roomCode,
            matchId: freshRoom.match.matchId,
            playerId: player.playerId,
            roundIndex: round.roundIndex,
            puzzleId: round.puzzleId,
            startTime: round.startedAt,
          },
        });
        emitToRoom(freshRoom.roomCode, serializePlayerState(freshRoom, player));
      }
    }, delay);
  };

  const buildRounds = (room: InternalRoom, matchId: string): RoundPuzzle[] =>
    room.settings.difficulties.map((difficulty: RoundPuzzle["difficulty"], roundIndex: number) => {
      const seed = hashSeed(`${room.roomCode}:${matchId}:${roundIndex}:${difficulty}`);
      const rng = mulberry32(seed);
      const puzzle = pickPuzzleByDifficulty(difficulty, rng);
      return {
        roundIndex,
        difficulty,
        puzzleId: puzzle.id,
      };
    });

  const startMatch = (room: InternalRoom) => {
    const matchId = createId("m");
    const nowMs = now();
    const startTime = nowMs + MATCH_COUNTDOWN_MS;
    const rounds = buildRounds(room, matchId);

    for (const player of Object.values(room.players)) {
      player.currentRoundIndex = 0;
      player.completedFinal = false;
      player.finalFinishedAt = undefined;
      player.splitsMs = Array.from({ length: rounds.length }, () => null);
      player.lastProcessedSeq = 0;
      player.ready = false;
      player.rounds = buildRoundStates(rounds, startTime);
    }

    room.status = "countdown";
    room.match = {
      matchId,
      countdownStartAt: nowMs,
      startedAt: startTime,
      rounds,
    };
    room.updatedAt = now();

    emitRoomState(room);
    emitToRoom(room.roomCode, {
      type: "matchStart",
      data: {
        roomCode: room.roomCode,
        matchId,
        startTime,
        rounds,
        countdownMs: countdownMs,
      },
    });
    scheduleCountdown(room);
    emitLobbyState();
  };

  const maybeFinishRound = (room: InternalRoom, player: InternalPlayerState, clientSeq: number) => {
    const finished = applyFinish(player, now());
    if (!finished.ok || !room.match) {
      if (!finished.ok) {
        const seatSocket = player.socketId ? io.sockets.sockets.get(player.socketId) : null;
        if (seatSocket) {
          emitEvent(
            seatSocket,
            serializeActionRejected({
              room,
              clientSeq,
              reason: finished.reason,
              player,
            }),
          );
        }
      }
      return;
    }

    const round = finished.round;
    if (!finished.alreadyFinished) {
      emitToRoom(room.roomCode, {
        type: "playerFinished",
        data: {
          roomCode: room.roomCode,
          matchId: room.match.matchId,
          playerId: player.playerId,
          roundIndex: round.roundIndex,
          finishedAt: round.finishedAt ?? now(),
          splitMs: finished.splitMs,
        },
      });
    }

    const finalRoundIndex = room.match.rounds.length - 1;
    if (round.roundIndex >= finalRoundIndex) {
      player.completedFinal = true;
      player.finalFinishedAt = round.finishedAt;

      if (!room.match.winnerId) {
        const decidedAt = now();
        const lockInMs = clampLockInMs(room.settings.lockInMs);
        room.match.winnerId = player.playerId;
        room.match.winnerDecidedAt = decidedAt;
        room.match.lockEndsAt = decidedAt + lockInMs;
        room.status = "winner_window";
        room.updatedAt = now();

        emitRoomState(room);
        emitToRoom(room.roomCode, {
          type: "winnerDecided",
          data: {
            roomCode: room.roomCode,
            matchId: room.match.matchId,
            winnerId: player.playerId,
            decidedAt,
            lockInMs,
            lockEndsAt: room.match.lockEndsAt,
          },
        });

        scheduleFinalize(room);
      }

      emitToRoom(room.roomCode, serializePlayerState(room, player));
      return;
    }

    if (room.status === "winner_window") {
      emitToRoom(room.roomCode, serializePlayerState(room, player));
      return;
    }

    const nextRound = tryAdvancePlayer(player, now());
    if (!nextRound) {
      emitToRoom(room.roomCode, serializePlayerState(room, player));
      return;
    }

    emitToRoom(room.roomCode, {
      type: "roundStart",
      data: {
        roomCode: room.roomCode,
        matchId: room.match.matchId,
        playerId: player.playerId,
        roundIndex: nextRound.roundIndex,
        puzzleId: nextRound.puzzleId,
        startTime: nextRound.startedAt,
      },
    });
    emitToRoom(room.roomCode, serializePlayerState(room, player));
  };

  const getSocketForSeat = (roomCode: string, playerId: string): Socket | null => {
    const player = roomManager.getPlayer(roomCode, playerId);
    if (!player?.socketId) return null;
    return io.sockets.sockets.get(player.socketId) ?? null;
  };

  const processAction = (socket: Socket, event: Extract<ReturnType<typeof safeParseClientEvent>, { success: true }>['data']) => {
    if (
      event.type !== "placePiece" &&
      event.type !== "removePiece" &&
      event.type !== "undo" &&
      event.type !== "submitFinish"
    ) {
      return;
    }

    const seat = roomManager.getSeat(socket.id);
    if (!seat) {
      return;
    }

    const room = roomManager.getRoom(seat.roomCode);
    const player = roomManager.getPlayer(seat.roomCode, seat.playerId);
    if (!room || !player || !room.match) {
      return;
    }

    const limiter = rateLimiterBySocket.get(socket.id) ?? new TokenBucket(15, 20);
    rateLimiterBySocket.set(socket.id, limiter);

    if (!limiter.tryTake()) {
      emitEvent(
        socket,
        serializeActionRejected({
          room,
          clientSeq: event.data.clientSeq,
          reason: "rate_limited",
          player,
        }),
      );
      return;
    }

    if (room.status !== "in_game" && room.status !== "winner_window") {
      emitEvent(
        socket,
        serializeActionRejected({
          room,
          clientSeq: event.data.clientSeq,
          reason: "stale_round",
          player,
        }),
      );
      return;
    }

    if (event.data.matchId !== room.match.matchId) {
      emitEvent(
        socket,
        serializeActionRejected({
          room,
          clientSeq: event.data.clientSeq,
          reason: "stale_match",
          player,
        }),
      );
      return;
    }

    if (event.data.roundIndex !== player.currentRoundIndex) {
      emitEvent(
        socket,
        serializeActionRejected({
          room,
          clientSeq: event.data.clientSeq,
          reason: "stale_round",
          player,
        }),
      );
      return;
    }

    const seqIssue = validateAndApplySeq(player, event.data.clientSeq);
    if (seqIssue) {
      emitEvent(
        socket,
        serializeActionRejected({
          room,
          clientSeq: event.data.clientSeq,
          reason: seqIssue,
          player,
        }),
      );
      return;
    }

    if (event.type === "placePiece") {
      const outcome = applyPlacePiece(
        player,
        {
          pieceId: event.data.pieceId,
          transformId: event.data.transform,
          x: event.data.x,
          y: event.data.y,
        },
        event.data.clientSeq,
      );

      if (!outcome.ok) {
        emitEvent(
          socket,
          serializeActionRejected({
            room,
            clientSeq: event.data.clientSeq,
            reason: outcome.reason,
            player,
          }),
        );
        return;
      }

      emitToRoom(room.roomCode, serializePlayerState(room, player));

      if (outcome.solved) {
        maybeFinishRound(room, player, event.data.clientSeq);
      }
      return;
    }

    if (event.type === "removePiece") {
      const outcome = applyRemovePiece(
        player,
        {
          pieceId: event.data.pieceId,
          placedId: event.data.placedId,
        },
        event.data.clientSeq,
      );
      if (!outcome.ok) {
        emitEvent(
          socket,
          serializeActionRejected({
            room,
            clientSeq: event.data.clientSeq,
            reason: outcome.reason,
            player,
          }),
        );
        return;
      }
      emitToRoom(room.roomCode, serializePlayerState(room, player));
      return;
    }

    if (event.type === "undo") {
      const outcome = applyUndo(player);
      if (!outcome.ok) {
        emitEvent(
          socket,
          serializeActionRejected({
            room,
            clientSeq: event.data.clientSeq,
            reason: outcome.reason,
            player,
          }),
        );
        return;
      }
      emitToRoom(room.roomCode, serializePlayerState(room, player));
      return;
    }

    maybeFinishRound(room, player, event.data.clientSeq);
  };

  io.on("connection", (socket: Socket) => {
    emitEvent(socket, serializeLobbyState(roomManager.listLobbyRooms()));

    socket.on(SOCKET_EVENT_NAME, (payload: unknown) => {
      const parsed = safeParseClientEvent(payload);
      if (!parsed.success) {
        emitEvent(socket, {
          type: "error",
          data: {
            code: "invalid_payload",
            message: "Invalid event payload.",
          },
        });
        return;
      }

      const event = parsed.data;

      if (event.type === "listRooms") {
        emitEvent(socket, serializeLobbyState(roomManager.listLobbyRooms()));
        return;
      }

      if (event.type === "joinRoom") {
        try {
          const existingSeat = roomManager.getSeat(socket.id);
          if (existingSeat) {
            roomManager.leaveBySocket(socket.id);
            socket.leave(existingSeat.roomCode);
          }

          const result = roomManager.joinByRequest({
            socket,
            name: event.data.name,
            roomCode: event.data.roomCode,
            queue: event.data.queue,
            settings: event.data.settings,
            resumeToken: event.data.resumeToken,
          });

          socket.join(result.room.roomCode);
          emitRoomState(result.room);
          emitEvent(socket, serializeRoomState(result.room, result.player));
          emitEvent(socket, serializeStateSync(result.room, result.player));
          emitLobbyState();
        } catch (error) {
          emitEvent(socket, {
            type: "error",
            data: {
              code:
                error instanceof Error && error.message
                  ? error.message
                  : "join_failed",
              message: "Unable to join room.",
            },
          });
        }
        return;
      }

      if (event.type === "leaveRoom") {
        const seat = roomManager.getSeat(socket.id);
        if (!seat) return;
        roomManager.leaveBySocket(socket.id);
        socket.leave(seat.roomCode);
        const room = roomManager.getRoom(seat.roomCode);
        if (room) {
          emitRoomState(room);
        }
        emitLobbyState();
        return;
      }

      if (event.type === "ready") {
        const seat = roomManager.getSeat(socket.id);
        if (!seat) return;
        const updated = roomManager.setPlayerReady(
          seat.roomCode,
          seat.playerId,
          event.data.ready,
        );
        if (!updated) return;
        const room = roomManager.getRoom(seat.roomCode);
        if (room) {
          emitRoomState(room);
        }
        return;
      }

      if (event.type === "startMatch") {
        const seat = roomManager.getSeat(socket.id);
        if (!seat) return;
        const room = roomManager.getRoom(seat.roomCode);
        if (!room) return;
        if (room.hostId !== seat.playerId) {
          emitEvent(socket, {
            type: "error",
            data: {
              code: "not_host",
              message: "Only host can start the match.",
            },
          });
          return;
        }

        if (Object.keys(room.players).length > MAX_PLAYERS) {
          emitEvent(socket, {
            type: "error",
            data: {
              code: "too_many_players",
              message: "Room has too many players.",
            },
          });
          return;
        }

        if (room.status !== "lobby" && room.status !== "finished") {
          emitEvent(socket, {
            type: "error",
            data: {
              code: "invalid_state",
              message: "Match cannot be started now.",
            },
          });
          return;
        }

        startMatch(room);
        return;
      }

      if (event.type === "requestSync") {
        const seat = roomManager.getSeat(socket.id);
        if (!seat) return;
        const room = roomManager.getRoom(seat.roomCode);
        const player = roomManager.getPlayer(seat.roomCode, seat.playerId);
        if (!room || !player) return;

        if (!room.match || room.match.matchId !== event.data.matchId) {
          emitEvent(socket, {
            type: "error",
            data: {
              code: "stale_match",
              message: "Match mismatch.",
            },
          });
          return;
        }

        emitEvent(socket, serializeStateSync(room, player));
        return;
      }

      processAction(socket, parsed.data);
    });

    socket.on("disconnect", () => {
      rateLimiterBySocket.delete(socket.id);
      const room = roomManager.markDisconnected(socket.id);
      if (!room) return;
      emitRoomState(room);
      emitLobbyState();
    });
  });

  const cleanupInterval = setInterval(() => {
    const touchedRooms = roomManager.cleanupExpiredGraces(now());
    for (const roomCode of touchedRooms) {
      const room = roomManager.getRoom(roomCode);
      if (room) {
        emitRoomState(room);
      }
    }

    if (touchedRooms.length > 0) {
      emitLobbyState();
    }
  }, 1000);

  httpServer.on("close", () => {
    clearInterval(cleanupInterval);
  });

  return {
    io,
    httpServer,
    start: () =>
      new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve());
      }),
  };
};
