"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  MatchSettings,
  PiecePlacement,
  RoundDef,
  ServerEvent,
} from "@blocker-rush/protocol";
import { SOCKET_EVENT_NAME, safeParseServerEvent } from "@blocker-rush/protocol";

const DEFAULT_SETTINGS: MatchSettings = {
  rounds: 1,
  difficulties: ["easy"],
  advanceMode: "solo",
  lockInMs: 20_000,
};

const resumeKey = (roomCode: string) =>
  `blockerRush.multiplayer.resume.${roomCode.toUpperCase()}`;

type RoundSnapshot = {
  roundIndex: number;
  puzzleId: string;
  startedAt: number;
  finishedAt?: number;
  splitMs?: number;
  placedPieces: PiecePlacement[];
  remainingPieceIds: string[];
  boardFilledCount: number;
};

export type TrackedPlayer = {
  playerId: string;
  name: string;
  connected: boolean;
  ready: boolean;
  currentRoundIndex: number;
  splitsMs: Array<number | null>;
  lastAppliedSeq: number;
  round?: RoundSnapshot;
};

export type MultiplayerState = {
  connected: boolean;
  lastConnectionLostAt?: number;
  reconnectRoomCode?: string;
  roomCode?: string;
  roomVisibility?: "public" | "private";
  status?: "lobby" | "countdown" | "in_game" | "winner_window" | "finished";
  hostId?: string;
  selfPlayerId?: string;
  settings: MatchSettings;
  lobbyRooms: Array<{
    roomCode: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    status: "lobby" | "countdown" | "in_game" | "winner_window" | "finished";
    settings: MatchSettings;
    visibility: "public" | "private";
  }>;
  players: Record<string, TrackedPlayer>;
  match?: {
    matchId: string;
    startTime: number;
    countdownMs: number;
    rounds: RoundDef[];
    lockEndsAt?: number;
  };
  winner?: {
    winnerId: string;
    decidedAt: number;
    lockInMs: number;
    lockEndsAt: number;
  };
  result?: {
    state: "finished";
    winnerId: string;
    placements: Array<{
      playerId: string;
      place: number;
      roundsCompleted: number;
      finalFinishAt?: number;
      status: "finished" | "dnf";
    }>;
    splitsByPlayer: Record<string, Array<number | null>>;
    winnerBoards: Array<{
      roundIndex: number;
      puzzleId: string;
      placedPieces: PiecePlacement[];
    }>;
  };
  clockOffsetMs: number;
  lastRejected?: {
    clientSeq: number;
    reason: string;
    authoritativeState?: {
      roundIndex: number;
      placedPieces: PiecePlacement[];
      remainingPieceIds: string[];
      lastAppliedSeq: number;
    };
  };
  error?: string;
};

const createInitialState = (): MultiplayerState => ({
  connected: false,
  settings: DEFAULT_SETTINGS,
  lobbyRooms: [],
  players: {},
  clockOffsetMs: 0,
});

const getRoundDef = (state: MultiplayerState, roundIndex: number) =>
  state.match?.rounds.find((round) => round.roundIndex === roundIndex);

const fallbackRoundSnapshot = (
  state: MultiplayerState,
  player: TrackedPlayer | undefined,
  roundIndex: number,
) => {
  const sameRound = player?.round?.roundIndex === roundIndex;
  const roundDef = getRoundDef(state, roundIndex);
  const fallbackStartTime =
    sameRound && player?.round
      ? player.round.startedAt
      : roundIndex === 0
        ? (state.match?.startTime ?? player?.round?.startedAt ?? 0)
        : (player?.round?.startedAt ?? 0);

  return {
    puzzleId:
      sameRound && player?.round
        ? player.round.puzzleId
        : (roundDef?.puzzleId ?? ""),
    startedAt: fallbackStartTime,
  };
};

export function useMultiplayerSocket() {
  const [state, setState] = useState<MultiplayerState>(createInitialState);
  const socketRef = useRef<Socket | null>(null);
  const clientSeqRef = useRef(0);

  useEffect(() => {
    // Connects to same origin with custom path
    const socket = io({
      path: '/api/socket',
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setState((prev) => ({
        ...prev,
        connected: true,
        error: undefined,
      }));
      socket.emit(SOCKET_EVENT_NAME, { type: "listRooms", data: {} });
    };

    const handleDisconnect = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        lastConnectionLostAt: Date.now(),
        reconnectRoomCode: prev.roomCode ?? prev.reconnectRoomCode,
        roomCode: undefined,
        roomVisibility: undefined,
        status: undefined,
        hostId: undefined,
        selfPlayerId: undefined,
        players: {},
        match: undefined,
        winner: undefined,
        result: undefined,
      }));
    };

    const handleMessage = (payload: unknown) => {
      const parsed = safeParseServerEvent(payload);
      if (!parsed.success) {
        return;
      }

      const event = parsed.data;
      setState((prev) => reduceServerEvent(prev, event));
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(SOCKET_EVENT_NAME, handleMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off(SOCKET_EVENT_NAME, handleMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback((event: unknown) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit(SOCKET_EVENT_NAME, event);
  }, []);

  const requestLobby = useCallback(() => {
    emit({ type: "listRooms", data: {} });
  }, [emit]);

  const joinPublic = useCallback(
    (name: string) => {
      emit({ type: "joinRoom", data: { name, queue: "public" } });
    },
    [emit],
  );

  const joinByCode = useCallback(
    (name: string, roomCode: string) => {
      const token =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem(resumeKey(roomCode));
      emit({
        type: "joinRoom",
        data: {
          name,
          roomCode,
          resumeToken: token ?? undefined,
        },
      });
    },
    [emit],
  );

  const createPrivate = useCallback(
    (name: string, settings: MatchSettings) => {
      emit({
        type: "joinRoom",
        data: {
          name,
          queue: "private",
          settings,
        },
      });
    },
    [emit],
  );

  const leaveRoom = useCallback(() => {
    emit({ type: "leaveRoom", data: {} });
    setState((prev) => ({
      ...createInitialState(),
      connected: prev.connected,
      lastConnectionLostAt: prev.lastConnectionLostAt,
      reconnectRoomCode: prev.reconnectRoomCode,
      lobbyRooms: prev.lobbyRooms,
      clockOffsetMs: prev.clockOffsetMs,
      settings: prev.settings,
    }));
    emit({ type: "listRooms", data: {} });
  }, [emit]);

  const setReady = useCallback(
    (ready: boolean) => {
      emit({ type: "ready", data: { ready } });
    },
    [emit],
  );

  const startMatch = useCallback(() => {
    emit({ type: "startMatch", data: {} });
  }, [emit]);

  const updateSettings = useCallback(
    (settings: MatchSettings) => {
      emit({ type: "updateSettings", data: { settings } });
    },
    [emit],
  );

  const requestSync = useCallback(() => {
    const matchId = state.match?.matchId;
    if (!matchId) return;
    emit({ type: "requestSync", data: { matchId } });
  }, [emit, state.match?.matchId]);

  const nextSeq = () => {
    clientSeqRef.current += 1;
    return clientSeqRef.current;
  };

  const sendPlace = useCallback(
    (input: {
      roundIndex: number;
      pieceId: string;
      transformId: string;
      x: number;
      y: number;
    }) => {
      const matchId = state.match?.matchId;
      if (!matchId) return null;
      const clientSeq = nextSeq();
      emit({
        type: "placePiece",
        data: {
          matchId,
          roundIndex: input.roundIndex,
          pieceId: input.pieceId,
          transform: input.transformId,
          x: input.x,
          y: input.y,
          clientSeq,
        },
      });
      return clientSeq;
    },
    [emit, state.match?.matchId],
  );

  const sendRemove = useCallback(
    (input: { roundIndex: number; pieceId: string }) => {
      const matchId = state.match?.matchId;
      if (!matchId) return null;
      const clientSeq = nextSeq();
      emit({
        type: "removePiece",
        data: {
          matchId,
          roundIndex: input.roundIndex,
          pieceId: input.pieceId,
          clientSeq,
        },
      });
      return clientSeq;
    },
    [emit, state.match?.matchId],
  );

  const sendUndo = useCallback(
    (roundIndex: number) => {
      const matchId = state.match?.matchId;
      if (!matchId) return null;
      const clientSeq = nextSeq();
      emit({
        type: "undo",
        data: {
          matchId,
          roundIndex,
          clientSeq,
        },
      });
      return clientSeq;
    },
    [emit, state.match?.matchId],
  );

  const submitFinish = useCallback(
    (roundIndex: number) => {
      const matchId = state.match?.matchId;
      if (!matchId) return null;
      const clientSeq = nextSeq();
      emit({
        type: "submitFinish",
        data: {
          matchId,
          roundIndex,
          clientSeq,
        },
      });
      return clientSeq;
    },
    [emit, state.match?.matchId],
  );

  const kickPlayer = useCallback(
    (playerId: string) => {
      emit({
        type: "kickPlayer",
        data: {
          playerId,
        },
      });
    },
    [emit],
  );

  return useMemo(
    () => ({
      state,
      requestLobby,
      joinPublic,
      joinByCode,
      createPrivate,
      leaveRoom,
      setReady,
      startMatch,
      updateSettings,
      requestSync,
      sendPlace,
      sendRemove,
      sendUndo,
      submitFinish,
      kickPlayer,
    }),
    [
      state,
      requestLobby,
      joinPublic,
      joinByCode,
      createPrivate,
      leaveRoom,
      setReady,
      startMatch,
      updateSettings,
      requestSync,
      sendPlace,
      sendRemove,
      sendUndo,
      submitFinish,
      kickPlayer,
    ],
  );
}

const reduceServerEvent = (
  prev: MultiplayerState,
  event: ServerEvent,
): MultiplayerState => {
  switch (event.type) {
    case "lobbyState": {
      return {
        ...prev,
        lobbyRooms: event.data.rooms,
      };
    }
    case "roomState": {
      if (event.data.you && typeof window !== "undefined") {
        window.localStorage.setItem(
          resumeKey(event.data.roomCode),
          event.data.you.resumeToken,
        );
      }

      const nextPlayers: Record<string, TrackedPlayer> = {};
      for (const roomPlayer of event.data.players) {
        const previous = prev.players[roomPlayer.playerId];
        nextPlayers[roomPlayer.playerId] = {
          playerId: roomPlayer.playerId,
          name: roomPlayer.name,
          connected: roomPlayer.connected,
          ready: roomPlayer.ready,
          currentRoundIndex: previous?.currentRoundIndex ?? 0,
          splitsMs: previous?.splitsMs ?? [],
          lastAppliedSeq: previous?.lastAppliedSeq ?? 0,
          round: previous?.round,
        };
      }

      return {
        ...prev,
        roomCode: event.data.roomCode,
        reconnectRoomCode: event.data.roomCode,
        roomVisibility: event.data.visibility,
        status: event.data.status,
        hostId: event.data.hostId,
        settings: event.data.settings,
        selfPlayerId: event.data.you?.playerId ?? prev.selfPlayerId,
        players: nextPlayers,
        lastConnectionLostAt: undefined,
        error: undefined,
      };
    }
    case "matchStart": {
      return {
        ...prev,
        match: {
          matchId: event.data.matchId,
          startTime: event.data.startTime,
          countdownMs: event.data.countdownMs,
          rounds: event.data.rounds,
        },
        result: undefined,
        winner: undefined,
      };
    }
    case "roundStart": {
      const player = prev.players[event.data.playerId];
      const nextRound = {
        roundIndex: event.data.roundIndex,
        puzzleId: event.data.puzzleId,
        startedAt: event.data.startTime,
        placedPieces: [],
        remainingPieceIds: [],
        boardFilledCount: 0,
      };

      const nextPlayer: TrackedPlayer = player
        ? {
            ...player,
            currentRoundIndex: event.data.roundIndex,
            round: nextRound,
          }
        : {
            playerId: event.data.playerId,
            name: event.data.playerId,
            connected: true,
            ready: false,
            currentRoundIndex: event.data.roundIndex,
            splitsMs: [],
            lastAppliedSeq: 0,
            round: nextRound,
          };

      return {
        ...prev,
        players: {
          ...prev.players,
          [event.data.playerId]: nextPlayer,
        },
      };
    }
    case "playerState": {
      const player = prev.players[event.data.playerId];
      const fallbackRound = fallbackRoundSnapshot(
        prev,
        player,
        event.data.roundIndex,
      );
      return {
        ...prev,
        players: {
          ...prev.players,
          [event.data.playerId]: {
            playerId: event.data.playerId,
            name: player?.name ?? event.data.playerId,
            connected: player?.connected ?? true,
            ready: player?.ready ?? false,
            currentRoundIndex: event.data.roundIndex,
            splitsMs: player?.splitsMs ?? [],
            lastAppliedSeq: event.data.lastAppliedSeq,
            round: {
              roundIndex: event.data.roundIndex,
              puzzleId: fallbackRound.puzzleId,
              startedAt: fallbackRound.startedAt,
              finishedAt: event.data.finishedAt,
              splitMs: event.data.splitMs,
              placedPieces: event.data.placedPieces,
              remainingPieceIds: event.data.remainingPieceIds,
              boardFilledCount: event.data.boardFilledCount,
            },
          },
        },
      };
    }
    case "actionRejected": {
      return {
        ...prev,
        lastRejected: {
          clientSeq: event.data.clientSeq,
          reason: event.data.reason,
          authoritativeState: event.data.authoritativeState,
        },
      };
    }
    case "playerFinished": {
      const player = prev.players[event.data.playerId];
      if (!player) return prev;
      const splits = [...player.splitsMs];
      splits[event.data.roundIndex] = event.data.splitMs;
      return {
        ...prev,
        players: {
          ...prev.players,
          [event.data.playerId]: {
            ...player,
            splitsMs: splits,
            round: player.round
              ? {
                  ...player.round,
                  finishedAt: event.data.finishedAt,
                  splitMs: event.data.splitMs,
                }
              : player.round,
          },
        },
      };
    }
    case "winnerDecided": {
      return {
        ...prev,
        winner: {
          winnerId: event.data.winnerId,
          decidedAt: event.data.decidedAt,
          lockInMs: event.data.lockInMs,
          lockEndsAt: event.data.lockEndsAt,
        },
        match: prev.match
          ? {
              ...prev.match,
              lockEndsAt: event.data.lockEndsAt,
            }
          : prev.match,
      };
    }
    case "matchResult": {
      return {
        ...prev,
        result: {
          state: "finished",
          winnerId: event.data.winnerId,
          placements: event.data.placements,
          splitsByPlayer: event.data.splitsByPlayer,
          winnerBoards: event.data.winnerBoards,
        },
      };
    }
    case "stateSync": {
      if (event.data.you && typeof window !== "undefined") {
        window.localStorage.setItem(
          resumeKey(event.data.roomCode),
          event.data.you.resumeToken,
        );
      }

      const players: Record<string, TrackedPlayer> = {};
      for (const player of event.data.players) {
        players[player.playerId] = {
          playerId: player.playerId,
          name: player.name,
          connected: player.connected,
          ready: prev.players[player.playerId]?.ready ?? false,
          currentRoundIndex: player.currentRoundIndex,
          splitsMs: player.splitsMs,
          lastAppliedSeq: player.lastAppliedSeq,
          round: player.round
            ? {
                roundIndex: player.round.roundIndex,
                puzzleId: player.round.puzzleId,
                startedAt: player.round.startedAt,
                finishedAt: player.round.finishedAt,
                placedPieces: player.round.placedPieces,
                remainingPieceIds: player.round.remainingPieceIds,
                boardFilledCount: player.round.boardFilledCount,
              }
            : undefined,
        };
      }

      return {
        ...prev,
        roomCode: event.data.roomCode,
        reconnectRoomCode: event.data.roomCode,
        roomVisibility: event.data.visibility,
        status: event.data.status,
        hostId: event.data.hostId,
        settings: event.data.settings,
        players,
        selfPlayerId: event.data.you?.playerId ?? prev.selfPlayerId,
        lastConnectionLostAt: undefined,
        match: event.data.match
          ? {
              matchId: event.data.match.matchId,
              startTime: event.data.match.startedAt,
              countdownMs: 0,
              rounds: event.data.match.rounds,
              lockEndsAt: event.data.match.lockEndsAt,
            }
          : prev.match,
        clockOffsetMs: event.data.now - Date.now(),
      };
    }
    case "error": {
      if (event.data.code === "kicked") {
        return {
          ...prev,
          roomCode: undefined,
          reconnectRoomCode: prev.reconnectRoomCode,
          roomVisibility: undefined,
          status: undefined,
          hostId: undefined,
          selfPlayerId: undefined,
          players: {},
          match: undefined,
          winner: undefined,
          result: undefined,
          error: event.data.message,
        };
      }
      return {
        ...prev,
        error: event.data.message,
      };
    }
    default:
      return prev;
  }
};
