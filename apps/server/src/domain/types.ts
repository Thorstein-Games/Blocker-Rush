import type { BoardState, Difficulty } from "@blocker-rush/shared";
import type {
  MatchPlacement,
  MatchSettings,
  MatchState,
  PlayerRoundState,
  PlayerState,
  Room,
} from "@blocker-rush/protocol";

export type InternalRoundState = PlayerRoundState & {
  board: BoardState;
};

export type InternalPlayerState = Omit<PlayerState, "rounds"> & {
  ready: boolean;
  rounds: Record<number, InternalRoundState>;
};

export type InternalRoom = Omit<Room, "players" | "match"> & {
  players: Record<string, InternalPlayerState>;
  match?: MatchState & {
    finalizeTimerId?: ReturnType<typeof setTimeout>;
    countdownTimerId?: ReturnType<typeof setTimeout>;
  };
};

export type RoomJoinResult = {
  room: InternalRoom;
  player: InternalPlayerState;
  createdRoom: boolean;
};

export type PlayerSeat = {
  roomCode: string;
  playerId: string;
};

export type RoomListEntry = {
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: Room["status"];
  settings: MatchSettings;
  visibility: "public" | "private";
};

export type RoundPuzzle = {
  roundIndex: number;
  difficulty: Difficulty;
  puzzleId: string;
};

export type MatchResultPayload = {
  winnerId: string;
  placements: MatchPlacement[];
  splitsByPlayer: Record<string, Array<number | null>>;
};
