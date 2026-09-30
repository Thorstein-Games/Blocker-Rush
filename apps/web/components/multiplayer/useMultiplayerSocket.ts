"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Colyseus from "colyseus.js";
import type {
  ActionRejectedReason,
  MatchPlacement,
  MatchSettings,
  PiecePlacement,
  RoundDef,
} from "@blocker-rush/protocol";

// Mirrors sheeple-game's getGameServerUrl() (lib/config/gameConfig.ts).
function getGameServerUrl(): string {
  const isDev =
    typeof window !== "undefined"
      ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      : process.env.NODE_ENV !== "production";

  if (isDev) {
    return "ws://localhost:2567";
  }

  return process.env.NEXT_PUBLIC_GAME_SERVER_URL || "wss://megingjord.onrender.com";
}

const DEFAULT_SETTINGS: MatchSettings = {
  rounds: 1,
  difficulties: ["easy"],
  advanceMode: "solo",
  lockInMs: 20_000,
};

// @colyseus/core@0.17's matchmake HTTP endpoint returns a flat seat
// reservation ({name, sessionId, roomId, processId}), but colyseus.js@0.16
// (the newest published client) expects it nested under `room`. This is a
// known, already-worked-around incompatibility — the sheeple-game client
// (Megingjord's other consumer) carries the same shim in ColyseusProvider.tsx.
function patchSeatReservationShim(client: Colyseus.Client) {
  const original = (
    client as unknown as {
      consumeSeatReservation: (...args: unknown[]) => unknown;
    }
  ).consumeSeatReservation.bind(client);

  (
    client as unknown as {
      consumeSeatReservation: (...args: unknown[]) => unknown;
    }
  ).consumeSeatReservation = (...args: unknown[]) => {
    const response = args[0] as { room?: unknown; name?: string; roomId?: string; processId?: string; publicAddress?: string };
    if (!response.room && response.name) {
      response.room = {
        name: response.name,
        roomId: response.roomId,
        clients: 0,
        maxClients: 0,
        processId: response.processId,
        publicAddress: response.publicAddress,
      };
    }
    return original(...args);
  };
}

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
  // The roomCode we just intentionally left or were kicked from. Guards
  // MultiplayerLobbyLanding's ?room=<code> auto-join effect: on leave/kick,
  // state.roomCode clears but the URL query param doesn't (that param is
  // only ever pushed forward, never stripped), so a freshly-mounted landing
  // page would otherwise immediately rejoin the same room by code — for a
  // kick, this defeats the kick outright since the room is usually still
  // populated. See useMultiplayerSocket's leaveRoom/player_removed handlers.
  leftRoomCode?: string;
  roomCode?: string;
  roomVisibility?: "public" | "private";
  status?: "lobby" | "countdown" | "in_game" | "finished";
  hostId?: string;
  selfPlayerId?: string;
  settings: MatchSettings;
  lobbyRooms: Array<{
    roomCode: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    status: "lobby" | "in_progress";
    visibility: "public" | "private";
  }>;
  players: Record<string, TrackedPlayer>;
  match?: {
    matchId: string;
    startTime: number;
    countdownMs: number;
    rounds: RoundDef[];
  };
  result?: {
    state: "finished";
    winnerId: string;
    placements: MatchPlacement[];
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
    reason: ActionRejectedReason;
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

type GameRoom = Colyseus.Room<any>;

export function useMultiplayerSocket() {
  const [state, setState] = useState<MultiplayerState>(createInitialState);
  const clientRef = useRef<Colyseus.Client | null>(null);
  const lobbyRoomRef = useRef<GameRoom | null>(null);
  const gameRoomRef = useRef<GameRoom | null>(null);
  const clientSeqRef = useRef(0);

  const nextSeq = useCallback(() => {
    clientSeqRef.current += 1;
    return clientSeqRef.current;
  }, []);

  // --- Lobby connection: room browsing + roomCode -> roomId resolution ---

  useEffect(() => {
    const client = new Colyseus.Client(getGameServerUrl());
    patchSeatReservationShim(client);
    clientRef.current = client;

    let disposed = false;

    client
      .joinOrCreate("lobby", {})
      .then((room) => {
        if (disposed) {
          room.leave();
          return;
        }
        lobbyRoomRef.current = room;
        setState((prev) => ({ ...prev, connected: true, error: undefined }));

        const syncLobbyRooms = () => {
          const rooms = (room.state.rooms ?? []) as Array<{
            roomType: string;
            roomCode: string;
            hostName: string;
            playerCount: number;
            maxPlayers: number;
            isStarted: boolean;
          }>;
          setState((prev) => ({
            ...prev,
            lobbyRooms: rooms
              .filter((r) => r.roomType === "blocker_rush")
              .map((r) => ({
                roomCode: r.roomCode,
                hostName: r.hostName,
                playerCount: r.playerCount,
                maxPlayers: r.maxPlayers,
                status: r.isStarted ? "in_progress" : "lobby",
                visibility: "public",
              })),
          }));
        };

        // colyseus.js@0.16's schema callback API (.onAdd/.onRemove/.listen)
        // isn't attached directly to room.state.* — it's only reachable
        // through getStateCallbacks(room). room.state itself is also only a
        // placeholder until the first full-state patch arrives, so defer
        // wiring to that; onAdd's own `immediate` replay then covers anything
        // already present by that point.
        room.onStateChange.once(() => {
          const $ = Colyseus.getStateCallbacks(room);
          $(room.state!).rooms!.onAdd(syncLobbyRooms);
          $(room.state!).rooms!.onRemove(syncLobbyRooms);
          syncLobbyRooms();
        });
      })
      .catch((error) => {
        console.error("Failed to connect to lobby:", error);
        setState((prev) => ({ ...prev, connected: false, error: "Failed to connect" }));
      });

    return () => {
      disposed = true;
      lobbyRoomRef.current?.leave();
      lobbyRoomRef.current = null;
      gameRoomRef.current?.leave();
      gameRoomRef.current = null;
      clientRef.current = null;
    };
  }, []);

  const resolveRoomCode = useCallback((roomCode: string): Promise<string> => {
    const lobby = lobbyRoomRef.current;
    if (!lobby) return Promise.reject(new Error("Not connected to lobby"));

    return new Promise((resolve, reject) => {
      const handler = (payload: { success: boolean; roomCode?: string; roomId?: string; error?: string }) => {
        if (payload.roomCode !== roomCode.trim().toUpperCase()) return;
        off();
        if (payload.success && payload.roomId) {
          resolve(payload.roomId);
        } else {
          reject(new Error(payload.error ?? "Room not found"));
        }
      };
      const off = lobby.onMessage("room_code_resolved", handler);
      lobby.send("resolve_room_code", { roomType: "blocker_rush", roomCode });
    });
  }, []);

  // --- Game room connection: message handlers, schema sync ---

  const attachGameRoom = useCallback((room: GameRoom) => {
    gameRoomRef.current?.removeAllListeners();
    gameRoomRef.current?.leave();
    gameRoomRef.current = room;
    clientSeqRef.current = 0;

    const syncPlayersFromSchema = () => {
      if (!room.state?.players) return;
      setState((prev) => {
        const nextPlayers: Record<string, TrackedPlayer> = {};
        room.state.players.forEach((p: any, sessionId: string) => {
          const previous = prev.players[sessionId];
          nextPlayers[sessionId] = {
            playerId: sessionId,
            name: p.playerName,
            connected: p.isConnected,
            ready: p.isReady,
            currentRoundIndex: previous?.currentRoundIndex ?? 0,
            splitsMs: previous?.splitsMs ?? [],
            lastAppliedSeq: previous?.lastAppliedSeq ?? 0,
            round: previous?.round,
          };
        });
        return { ...prev, players: nextPlayers };
      });
    };

    const syncRoomMeta = () => {
      if (!room.state?.difficulties) return;
      setState((prev) => ({
        ...prev,
        roomCode: room.state.roomCode,
        reconnectRoomCode: room.state.roomCode,
        roomVisibility: room.state.visibility,
        status: room.state.status,
        hostId: room.state.hostId,
        settings: {
          rounds: room.state.rounds,
          difficulties: Array.from(room.state.difficulties) as MatchSettings["difficulties"],
          advanceMode: "solo",
          lockInMs: room.state.lockInMs,
        },
        selfPlayerId: room.sessionId,
        lastConnectionLostAt: undefined,
        leftRoomCode: undefined,
        error: undefined,
      }));
    };

    // Same getStateCallbacks + deferred-wiring requirement as the lobby
    // connection above — see the comment there.
    room.onStateChange.once(() => {
      const $ = Colyseus.getStateCallbacks(room);
      $(room.state!).players!.onAdd((player: any, sessionId: string) => {
        $(player).listen("isConnected", () => syncPlayersFromSchema());
        $(player).listen("isReady", () => syncPlayersFromSchema());
        $(player).listen("playerName", () => syncPlayersFromSchema());
        syncPlayersFromSchema();
      });
      // Rebuilding the full map from `room.state.players.forEach(...)` here
      // (like syncPlayersFromSchema does elsewhere) is unsafe: colyseus.js's
      // MapSchema onRemove callback fires while `.size`/`.forEach()` are
      // still stale for that synchronous tick (`.has(sessionId)` already
      // correctly reports false, but a forEach snapshot re-adds the
      // just-removed player). Apply the removal directly against the
      // previous React state instead of re-deriving it from the collection.
      $(room.state!).players!.onRemove((_player: any, sessionId: string) => {
        setState((prev) => {
          if (!(sessionId in prev.players)) return prev;
          const nextPlayers = { ...prev.players };
          delete nextPlayers[sessionId];
          return { ...prev, players: nextPlayers };
        });
      });
    });
    // `.listen(field, cb)` only fires on *future* mutations — roomCode/status/etc
    // are already set by the time this room resolves, so a per-field listen
    // registered now would miss that initial value. onStateChange fires on
    // every incoming patch (including the first), so it catches the initial
    // snapshot too; re-deriving all of syncRoomMeta's fields each time is cheap.
    room.onStateChange(syncRoomMeta);

    room.onMessage("match_start", (data: any) => {
      clientSeqRef.current = 0;
      setState((prev) => ({
        ...prev,
        match: {
          matchId: data.matchId,
          startTime: data.startTime,
          countdownMs: data.countdownMs,
          rounds: data.rounds,
        },
        result: undefined,
      }));
    });

    room.onMessage("round_start", (data: any) => {
      setState((prev) => {
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
      });
    });

    room.onMessage("player_state", (data: any) => {
      setState((prev) => {
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
      });
      if (data.playerId === room.sessionId) {
        clientSeqRef.current = data.lastAppliedSeq;
      }
    });

    room.onMessage("action_rejected", (data: any) => {
      setState((prev) => ({
        ...prev,
        lastRejected: {
          clientSeq: data.clientSeq,
          reason: data.reason,
          authoritativeState: data.authoritativeState,
        },
      }));
      if (typeof data.authoritativeState?.lastAppliedSeq === "number") {
        clientSeqRef.current = data.authoritativeState.lastAppliedSeq;
      }
    });

    room.onMessage("player_finished", (data: any) => {
      setState((prev) => {
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
      });
    });

    room.onMessage("match_result", (data: any) => {
      setState((prev) => ({
        ...prev,
        result: {
          state: "finished",
          winnerId: data.winnerId,
          placements: data.placements,
          splitsByPlayer: data.splitsByPlayer,
          winnerBoards: data.winnerBoards,
        },
      }));
    });

    room.onMessage("state_sync", (data: any) => {
      setState((prev) => {
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
          if (p.playerId === room.sessionId) {
            clientSeqRef.current = p.lastAppliedSeq;
          }
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
          clockOffsetMs: data.now - Date.now(),
        };
      });
    });

    room.onMessage("error", (data: any) => {
      setState((prev) => ({ ...prev, error: data.message }));
    });

    room.onMessage("player_removed", (data: any) => {
      if (data.sessionId === room.sessionId) {
        setState((prev) => ({
          ...prev,
          roomCode: undefined,
          roomVisibility: undefined,
          status: undefined,
          hostId: undefined,
          selfPlayerId: undefined,
          players: {},
          match: undefined,
          result: undefined,
          // Unlike a dropped connection (see onLeave below), this is
          // intentional/final - don't let the ?room=<code> auto-join effect
          // walk us right back into a room we were just kicked from.
          leftRoomCode: prev.roomCode ?? prev.leftRoomCode,
          error: data.reason === "kicked" ? "You were removed from the room." : prev.error,
        }));
      }
    });

    room.onLeave(() => {
      setState((prev) => ({
        ...prev,
        connected: prev.connected, // lobby connection is independent
        lastConnectionLostAt: Date.now(),
        reconnectRoomCode: prev.roomCode ?? prev.reconnectRoomCode,
        roomCode: undefined,
        roomVisibility: undefined,
        status: undefined,
        hostId: undefined,
        selfPlayerId: undefined,
        players: {},
        match: undefined,
        result: undefined,
      }));
      gameRoomRef.current = null;
    });

    room.send("client_ready");
  }, []);

  // --- Actions ---

  const requestLobby = useCallback(() => {
    lobbyRoomRef.current?.send("list_rooms", {});
  }, []);

  const joinPublic = useCallback(
    async (name: string) => {
      const client = clientRef.current;
      if (!client) return;
      const room = await client.joinOrCreate("blocker_rush", { playerName: name });
      attachGameRoom(room);
    },
    [attachGameRoom],
  );

  const joinByCode = useCallback(
    async (name: string, roomCode: string) => {
      const client = clientRef.current;
      if (!client || !roomCode.trim()) return;
      try {
        const roomId = await resolveRoomCode(roomCode);
        const room = await client.joinById(roomId, { playerName: name });
        attachGameRoom(room);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to join room",
        }));
      }
    },
    [attachGameRoom, resolveRoomCode],
  );

  const createPrivate = useCallback(
    async (name: string, settings: MatchSettings) => {
      const client = clientRef.current;
      if (!client) return;
      const room = await client.create("blocker_rush", { playerName: name, settings, private: true });
      attachGameRoom(room);
    },
    [attachGameRoom],
  );

  const leaveRoom = useCallback(() => {
    clientSeqRef.current = 0;
    gameRoomRef.current?.leave();
    gameRoomRef.current = null;
    setState((prev) => ({
      ...createInitialState(),
      connected: prev.connected,
      lastConnectionLostAt: prev.lastConnectionLostAt,
      reconnectRoomCode: prev.reconnectRoomCode,
      leftRoomCode: prev.roomCode ?? prev.leftRoomCode,
      lobbyRooms: prev.lobbyRooms,
      clockOffsetMs: prev.clockOffsetMs,
      settings: prev.settings,
    }));
  }, []);

  // Server toggles readiness on each `ready` message rather than taking an
  // explicit boolean — callers already always pass the negated current value,
  // so the parameter is accepted (to avoid touching call sites) but unused.
  const setReady = useCallback((_ready: boolean) => {
    gameRoomRef.current?.send("ready");
  }, []);

  const setDisplayName = useCallback((name: string) => {
    gameRoomRef.current?.send("update_player_name", { newName: name });
  }, []);

  const startMatch = useCallback(() => {
    gameRoomRef.current?.send("start_match");
  }, []);

  const updateSettings = useCallback((settings: MatchSettings) => {
    gameRoomRef.current?.send("update_settings", { settings });
  }, []);

  const requestSync = useCallback(() => {
    const room = gameRoomRef.current;
    const matchId = state.match?.matchId;
    if (!room || !matchId) return;
    room.send("request_sync", { matchId });
  }, [state.match?.matchId]);

  const sendPlace = useCallback(
    (input: { roundIndex: number; pieceId: string; transformId: string; x: number; y: number }) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      room.send("place_piece", {
        matchId,
        roundIndex: input.roundIndex,
        pieceId: input.pieceId,
        transform: input.transformId,
        x: input.x,
        y: input.y,
        clientSeq,
      });
      return clientSeq;
    },
    [nextSeq, state.match?.matchId],
  );

  const sendRemove = useCallback(
    (input: { roundIndex: number; pieceId: string }) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      room.send("remove_piece", {
        matchId,
        roundIndex: input.roundIndex,
        pieceId: input.pieceId,
        clientSeq,
      });
      return clientSeq;
    },
    [nextSeq, state.match?.matchId],
  );

  const sendUndo = useCallback(
    (roundIndex: number) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      room.send("undo", { matchId, roundIndex, clientSeq });
      return clientSeq;
    },
    [nextSeq, state.match?.matchId],
  );

  const submitFinish = useCallback(
    (roundIndex: number) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      room.send("submit_finish", { matchId, roundIndex, clientSeq });
      return clientSeq;
    },
    [nextSeq, state.match?.matchId],
  );

  const kickPlayer = useCallback((playerId: string) => {
    gameRoomRef.current?.send("kick_player", { sessionId: playerId });
  }, []);

  return useMemo(
    () => ({
      state,
      requestLobby,
      joinPublic,
      joinByCode,
      createPrivate,
      leaveRoom,
      setReady,
      setDisplayName,
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
      setDisplayName,
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
