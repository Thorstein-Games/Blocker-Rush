"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Colyseus from "colyseus.js";
import type { MatchSettings, ServerMessages } from "@blocker-rush/protocol";
import type { PieceId } from "@blocker-rush/shared";
import {
  getGameServerUrl,
  patchSeatReservationShim,
  sendGame,
  type GameRoom,
} from "./colyseusClient";
import {
  applyActionRejected,
  applyError,
  applyMatchResult,
  applyMatchStart,
  applyPlayerFinished,
  applyPlayerState,
  applyRoomLeft,
  applyRoundStart,
  applySelfRemoved,
  applyStateSync,
} from "./multiplayerReducers";
import {
  createInitialState,
  type MultiplayerState,
  type TrackedPlayer,
} from "./multiplayerTypes";

export type { MultiplayerState, TrackedPlayer } from "./multiplayerTypes";

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
    // connection above — see the comment there. Deliberately NOT
    // `onStateChange.once`: colyseus.js@0.16's signal removes a `once`
    // handler mid-forEach by swapping the last handler into its slot, so the
    // handler registered right after it (syncRoomMeta below) is skipped on
    // the initial full-state dispatch — the room joins but roomCode never
    // reaches React state until some later patch happens to arrive.
    let schemaCallbacksWired = false;
    room.onStateChange(() => {
      if (schemaCallbacksWired) return;
      schemaCallbacksWired = true;
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

    room.onMessage("match_start", (data: ServerMessages["match_start"]) => {
      clientSeqRef.current = 0;
      setState((prev) => applyMatchStart(prev, data));
    });

    room.onMessage("round_start", (data: ServerMessages["round_start"]) => {
      setState((prev) => applyRoundStart(prev, data));
    });

    room.onMessage("player_state", (data: ServerMessages["player_state"]) => {
      setState((prev) => applyPlayerState(prev, data));
      if (data.playerId === room.sessionId) {
        clientSeqRef.current = data.lastAppliedSeq;
      }
    });

    room.onMessage("action_rejected", (data: ServerMessages["action_rejected"]) => {
      setState((prev) => applyActionRejected(prev, data));
      if (typeof data.authoritativeState?.lastAppliedSeq === "number") {
        clientSeqRef.current = data.authoritativeState.lastAppliedSeq;
      }
    });

    room.onMessage("player_finished", (data: ServerMessages["player_finished"]) => {
      setState((prev) => applyPlayerFinished(prev, data));
    });

    room.onMessage("match_result", (data: ServerMessages["match_result"]) => {
      setState((prev) => applyMatchResult(prev, data));
    });

    room.onMessage("state_sync", (data: ServerMessages["state_sync"]) => {
      setState((prev) => applyStateSync(prev, data));
      const self = data.players.find((p) => p.playerId === room.sessionId);
      if (self) {
        clientSeqRef.current = self.lastAppliedSeq;
      }
    });

    room.onMessage("error", (data: ServerMessages["error"]) => {
      setState((prev) => applyError(prev, data));
    });

    room.onMessage("player_removed", (data: ServerMessages["player_removed"]) => {
      if (data.sessionId === room.sessionId) {
        setState((prev) => applySelfRemoved(prev, data));
      }
    });

    room.onLeave(() => {
      setState((prev) => applyRoomLeft(prev));
      gameRoomRef.current = null;
    });

    // BaseGameRoom protocol messages we don't consume — players/host/status are
    // derived from schema state instead. Registered as no-ops so colyseus.js
    // doesn't log "onMessage() not registered" for each one.
    for (const type of [
      "welcome",
      "player_list",
      "player_joined",
      "player_reconnected",
      "player_disconnected",
      "host_changed",
      "spectator_joined",
      "spectator_left",
      "chat",
      "pong",
    ]) {
      room.onMessage(type, () => {});
    }

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
      try {
        const room = await client.joinOrCreate("blocker_rush", { playerName: name });
        attachGameRoom(room);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to join room",
        }));
      }
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
      try {
        const room = await client.create("blocker_rush", { playerName: name, settings, private: true });
        attachGameRoom(room);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to create room",
        }));
      }
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
    gameRoomRef.current && sendGame(gameRoomRef.current, "start_match", undefined);
  }, []);

  const updateSettings = useCallback((settings: MatchSettings) => {
    gameRoomRef.current && sendGame(gameRoomRef.current, "update_settings", { settings });
  }, []);

  const requestSync = useCallback(() => {
    const room = gameRoomRef.current;
    const matchId = state.match?.matchId;
    if (!room || !matchId) return;
    sendGame(room, "request_sync", { matchId });
  }, [state.match?.matchId]);

  const sendPlace = useCallback(
    (input: { roundIndex: number; pieceId: PieceId; transformId: string; x: number; y: number }) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      sendGame(room, "place_piece", {
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
    (input: { roundIndex: number; pieceId: PieceId }) => {
      const room = gameRoomRef.current;
      const matchId = state.match?.matchId;
      if (!room || !matchId) return null;
      const clientSeq = nextSeq();
      sendGame(room, "remove_piece", {
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
      sendGame(room, "undo", { matchId, roundIndex, clientSeq });
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
      sendGame(room, "submit_finish", { matchId, roundIndex, clientSeq });
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
