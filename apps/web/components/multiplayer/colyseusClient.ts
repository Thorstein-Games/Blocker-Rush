// Colyseus client plumbing for the megingjord `blocker_rush` room.
import * as Colyseus from "colyseus.js";
import type { ClientMessages } from "@blocker-rush/protocol";

// Mirrors sheeple-game's getGameServerUrl() (lib/config/gameConfig.ts).
export function getGameServerUrl(): string {
  const isDev =
    typeof window !== "undefined"
      ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      : process.env.NODE_ENV !== "production";

  if (isDev) {
    return "ws://localhost:2567";
  }

  return process.env.NEXT_PUBLIC_GAME_SERVER_URL || "wss://megingjord.onrender.com";
}

// @colyseus/core@0.17's matchmake HTTP endpoint returns a flat seat
// reservation ({name, sessionId, roomId, processId}), but colyseus.js@0.16
// (the newest published client) expects it nested under `room`. This is a
// known, already-worked-around incompatibility — the sheeple-game client
// (Megingjord's other consumer) carries the same shim in ColyseusProvider.tsx.
export function patchSeatReservationShim(client: Colyseus.Client) {
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

export type GameRoom = Colyseus.Room<any>;

/** room.send, typed against the protocol's ClientMessages map. */
export const sendGame = <K extends keyof ClientMessages>(
  room: GameRoom,
  type: K,
  payload: ClientMessages[K],
) => room.send(type, payload);
