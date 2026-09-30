// Client-side view of a Blocker Rush room, built from schema state plus
// server messages (see multiplayerReducers.ts / useMultiplayerSocket.ts).
import type {
  ActionRejectedReason,
  MatchPlacement,
  MatchSettings,
  PiecePlacement,
  RoundDef,
} from "@blocker-rush/protocol";

export const DEFAULT_SETTINGS: MatchSettings = {
  rounds: 1,
  difficulties: ["easy"],
  advanceMode: "solo",
  lockInMs: 20_000,
};

export type RoundSnapshot = {
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

export const createInitialState = (): MultiplayerState => ({
  connected: false,
  settings: DEFAULT_SETTINGS,
  lobbyRooms: [],
  players: {},
  clockOffsetMs: 0,
});
