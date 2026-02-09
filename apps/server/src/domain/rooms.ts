import {
  MAX_PLAYERS,
  REJOIN_GRACE_MS,
  type MatchSettings,
} from "@blocker-rush/protocol";
import type {
  InternalPlayerState,
  InternalRoom,
  PlayerSeat,
  RoomJoinResult,
  RoomListEntry,
} from "./types";
import { createId, createRoomCode, normalizeSettings, now } from "./utils";

type SocketLike = {
  id: string;
};

const FINISHED_ROOM_TTL_MS = 15 * 60_000;
const MAX_ROOM_AGE_MS = 6 * 60 * 60_000;

const shouldClearStaleRoom = (
  room: InternalRoom,
  currentNow: number,
): boolean => {
  const roomAgeMs = currentNow - room.createdAt;
  if (roomAgeMs >= MAX_ROOM_AGE_MS) {
    return true;
  }

  if (room.status === "finished") {
    return currentNow - room.updatedAt >= FINISHED_ROOM_TTL_MS;
  }

  return false;
};

const makePlayer = (
  name: string,
  socketId: string,
  roundsCount = 0,
): InternalPlayerState => ({
  playerId: createId("u"),
  name,
  socketId,
  resumeToken: createId("r"),
  connected: true,
  currentRoundIndex: 0,
  completedFinal: false,
  splitsMs: Array.from({ length: roundsCount }, () => null),
  lastProcessedSeq: 0,
  rounds: {},
  ready: false,
});

export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly socketSeats = new Map<string, PlayerSeat>();

  listLobbyRooms(): RoomListEntry[] {
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.status === "lobby" ||
          room.status === "countdown" ||
          room.status === "in_game" ||
          room.status === "winner_window",
      )
      .map((room) => {
        const host = room.players[room.hostId];
        return {
          roomCode: room.roomCode,
          hostName: host?.name ?? "Host",
          playerCount: Object.keys(room.players).length,
          maxPlayers: MAX_PLAYERS,
          status: room.status,
          settings: room.settings,
          visibility: room.visibility,
        };
      });
  }

  getRoom(roomCode: string): InternalRoom | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getSeat(socketId: string): PlayerSeat | undefined {
    return this.socketSeats.get(socketId);
  }

  getPlayer(
    roomCode: string,
    playerId: string,
  ): InternalPlayerState | undefined {
    return this.rooms.get(roomCode)?.players[playerId];
  }

  listPlayers(roomCode: string): InternalPlayerState[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Object.values(room.players);
  }

  touchRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.updatedAt = now();
  }

  joinByRequest(params: {
    socket: SocketLike;
    name: string;
    roomCode?: string;
    queue?: "public" | "private";
    settings?: MatchSettings;
    resumeToken?: string;
  }): RoomJoinResult {
    const trimmedName = params.name.trim().slice(0, 24);
    if (!trimmedName) {
      throw new Error("name_required");
    }

    const requestedRoomCode = params.roomCode?.trim().toUpperCase();

    if (requestedRoomCode && params.resumeToken) {
      const room = this.rooms.get(requestedRoomCode);
      if (room) {
        const player = Object.values(room.players).find(
          (entry) => entry.resumeToken === params.resumeToken,
        );
        if (player && player.graceExpiresAt && player.graceExpiresAt >= now()) {
          player.connected = true;
          player.socketId = params.socket.id;
          player.disconnectedAt = undefined;
          player.graceExpiresAt = undefined;
          this.socketSeats.set(params.socket.id, {
            roomCode: room.roomCode,
            playerId: player.playerId,
          });
          this.touchRoom(room.roomCode);
          return { room, player, createdRoom: false };
        }
      }
    }

    let room: InternalRoom | undefined;
    let createdRoom = false;

    if (requestedRoomCode) {
      room = this.rooms.get(requestedRoomCode);
      if (!room) {
        throw new Error("room_not_found");
      }

      if (room.status !== "lobby") {
        throw new Error("room_not_joinable");
      }
    } else if (params.queue === "public") {
      room = [...this.rooms.values()].find(
        (entry) =>
          entry.visibility === "public" &&
          entry.status === "lobby" &&
          Object.keys(entry.players).length < MAX_PLAYERS,
      );

      if (!room) {
        room = this.createRoom(
          "public",
          normalizeSettings(),
          params.socket.id,
          trimmedName,
        );
        createdRoom = true;
      }
    } else {
      room = this.createRoom(
        "private",
        normalizeSettings(params.settings),
        params.socket.id,
        trimmedName,
      );
      createdRoom = true;
    }

    if (!room) {
      throw new Error("unable_to_join");
    }

    if (createdRoom) {
      const host = room.players[room.hostId];
      if (!host) {
        throw new Error("host_missing");
      }
      room.updatedAt = now();
      return { room, player: host, createdRoom: true };
    }

    if (Object.keys(room.players).length >= MAX_PLAYERS) {
      throw new Error("room_full");
    }

    const player = makePlayer(
      trimmedName,
      params.socket.id,
      room.settings.rounds,
    );
    room.players[player.playerId] = player;
    if (!room.hostId) {
      room.hostId = player.playerId;
    }
    room.updatedAt = now();

    this.socketSeats.set(params.socket.id, {
      roomCode: room.roomCode,
      playerId: player.playerId,
    });

    return { room, player, createdRoom };
  }

  createRoom(
    visibility: "public" | "private",
    settings: MatchSettings,
    socketId: string,
    hostName: string,
  ): InternalRoom {
    let roomCode = createRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = createRoomCode();
    }

    const hostPlayer = makePlayer(hostName, socketId, settings.rounds);
    const room: InternalRoom = {
      roomCode,
      hostId: hostPlayer.playerId,
      status: "lobby",
      visibility,
      settings,
      players: {
        [hostPlayer.playerId]: hostPlayer,
      },
      createdAt: now(),
      updatedAt: now(),
    };

    this.rooms.set(roomCode, room);
    this.socketSeats.set(socketId, { roomCode, playerId: hostPlayer.playerId });

    return room;
  }

  setPlayerReady(roomCode: string, playerId: string, ready: boolean): boolean {
    const room = this.rooms.get(roomCode);
    const player = room?.players[playerId];
    if (!room || !player) return false;
    player.ready = ready;
    room.updatedAt = now();
    return true;
  }

  updateRoomSettings(
    roomCode: string,
    hostPlayerId: string,
    settings: MatchSettings,
  ): InternalRoom | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.hostId !== hostPlayerId) return null;
    if (room.status !== "lobby") return null;

    const nextSettings = normalizeSettings(settings);
    room.settings = nextSettings;
    for (const player of Object.values(room.players)) {
      player.ready = false;
      player.splitsMs = Array.from({ length: nextSettings.rounds }, () => null);
    }
    room.updatedAt = now();

    return room;
  }

  leaveBySocket(socketId: string): InternalRoom | null {
    const seat = this.socketSeats.get(socketId);
    if (!seat) return null;
    this.socketSeats.delete(socketId);
    return this.leavePlayer(seat.roomCode, seat.playerId);
  }

  leavePlayer(roomCode: string, playerId: string): InternalRoom | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players[playerId];
    if (!player) return room;

    if (player.socketId) {
      this.socketSeats.delete(player.socketId);
    }

    delete room.players[playerId];

    if (room.hostId === playerId) {
      const nextHost = Object.values(room.players)[0];
      room.hostId = nextHost?.playerId ?? "";
    }

    if (Object.keys(room.players).length === 0) {
      this.clearRoom(room.roomCode);
      return null;
    }

    room.updatedAt = now();
    return room;
  }

  markDisconnected(socketId: string): InternalRoom | null {
    const seat = this.socketSeats.get(socketId);
    if (!seat) return null;

    const room = this.rooms.get(seat.roomCode);
    const player = room?.players[seat.playerId];
    this.socketSeats.delete(socketId);

    if (!room || !player) return room ?? null;

    player.connected = false;
    player.socketId = undefined;
    player.disconnectedAt = now();
    player.graceExpiresAt = player.disconnectedAt + REJOIN_GRACE_MS;
    room.updatedAt = now();

    return room;
  }

  cleanupExpiredGraces(currentNow = now()): {
    touchedRoomCodes: string[];
    removedRoomCodes: string[];
  } {
    const touched = new Set<string>();
    const removed = new Set<string>();

    for (const room of [...this.rooms.values()]) {
      for (const player of Object.values(room.players)) {
        if (
          !player.connected &&
          player.graceExpiresAt &&
          player.graceExpiresAt <= currentNow
        ) {
          player.graceExpiresAt = undefined;
          player.disconnectedAt = undefined;

          if (room.status === "lobby") {
            delete room.players[player.playerId];
            touched.add(room.roomCode);
          }
        }
      }

      const players = Object.values(room.players);
      const connectedPlayers = players.filter((player) => player.connected);
      const allDisconnected =
        players.length > 0 && connectedPlayers.length === 0;
      const allDisconnectedGraceExpired =
        allDisconnected &&
        players.every(
          (player) =>
            !player.graceExpiresAt || player.graceExpiresAt <= currentNow,
        );

      if (
        players.length === 0 ||
        allDisconnectedGraceExpired ||
        shouldClearStaleRoom(room, currentNow)
      ) {
        removed.add(room.roomCode);
        this.clearRoom(room.roomCode);
        continue;
      }

      if (!room.players[room.hostId]) {
        const nextHost = Object.values(room.players)[0];
        room.hostId = nextHost?.playerId ?? "";
        touched.add(room.roomCode);
      }
    }

    return {
      touchedRoomCodes: [...touched],
      removedRoomCodes: [...removed],
    };
  }

  clearRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    if (room.match?.countdownTimerId) {
      clearTimeout(room.match.countdownTimerId);
    }
    for (const player of Object.values(room.players)) {
      if (player.socketId) {
        this.socketSeats.delete(player.socketId);
      }
    }

    this.rooms.delete(roomCode);
  }
}
