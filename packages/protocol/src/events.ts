import { z } from "zod";
import type {
  ActionRejectedReason,
  MatchPlacement,
  MatchSettings,
  MatchState,
  PiecePlacement,
  RoomStatus,
  RoundDef,
} from "./domain";

export const SOCKET_EVENT_NAME = "blocker:event";

const roomStatusSchema = z.enum([
  "lobby",
  "countdown",
  "in_game",
  "winner_window",
  "finished",
]);

const difficultySchema = z.enum(["easy", "medium", "hard", "insane"]);
const pieceIdSchema = z.enum([
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
  "p9",
]);

const matchSettingsSchemaBase = z
  .object({
    rounds: z.number().int().min(1).max(3),
    difficulties: z.array(difficultySchema).min(1).max(3),
    advanceMode: z.literal("solo"),
    lockInMs: z.number().int().min(10_000).max(30_000),
  })
  .strict();

const matchSettingsSchema = matchSettingsSchemaBase
  .superRefine((value: z.infer<typeof matchSettingsSchemaBase>, ctx: z.RefinementCtx) => {
    if (value.difficulties.length !== value.rounds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["difficulties"],
        message: "difficulties length must match rounds",
      });
    }
  });

const piecePlacementSchema = z
  .object({
    pieceId: pieceIdSchema,
    transformId: z.string().min(1),
    x: z.number().int(),
    y: z.number().int(),
  })
  .strict();

const roundDefSchema = z
  .object({
    roundIndex: z.number().int().min(0),
    difficulty: difficultySchema,
    puzzleId: z.string().min(1),
  })
  .strict();

const matchStateSchema = z
  .object({
    matchId: z.string().min(1),
    startedAt: z.number().int(),
    countdownStartAt: z.number().int(),
    rounds: z.array(roundDefSchema),
    winnerId: z.string().min(1).optional(),
    winnerDecidedAt: z.number().int().optional(),
    lockEndsAt: z.number().int().optional(),
  })
  .strict();

const actionRejectedReasonSchema = z.enum([
  "invalid_payload",
  "rate_limited",
  "stale_match",
  "stale_round",
  "duplicate_seq",
  "out_of_order_seq",
  "invalid_transform",
  "piece_unavailable",
  "out_of_bounds",
  "collision",
  "blocked",
  "invalid_remove",
  "invalid_undo",
  "not_solved",
]);

const joinRoomSchema = z
  .object({
    type: z.literal("joinRoom"),
    data: z
      .object({
        name: z.string().trim().min(1).max(24),
        roomCode: z.string().trim().min(4).max(12).optional(),
        queue: z.enum(["public", "private"]).optional(),
        settings: matchSettingsSchema.optional(),
        resumeToken: z.string().trim().min(8).optional(),
      })
      .strict(),
  })
  .strict();

const leaveRoomSchema = z
  .object({
    type: z.literal("leaveRoom"),
    data: z.object({}).strict(),
  })
  .strict();

const readySchema = z
  .object({
    type: z.literal("ready"),
    data: z.object({ ready: z.boolean() }).strict(),
  })
  .strict();

const kickPlayerSchema = z
  .object({
    type: z.literal("kickPlayer"),
    data: z.object({ playerId: z.string().min(1) }).strict(),
  })
  .strict();

const updateSettingsSchema = z
  .object({
    type: z.literal("updateSettings"),
    data: z.object({ settings: matchSettingsSchema }).strict(),
  })
  .strict();

const startMatchSchema = z
  .object({
    type: z.literal("startMatch"),
    data: z.object({}).strict(),
  })
  .strict();

const placePieceSchema = z
  .object({
    type: z.literal("placePiece"),
    data: z
      .object({
        matchId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        pieceId: pieceIdSchema,
        transform: z.string().min(1),
        x: z.number().int(),
        y: z.number().int(),
        clientSeq: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const removePieceSchema = z
  .object({
    type: z.literal("removePiece"),
    data: z
      .object({
        matchId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        placedId: z.string().min(1).optional(),
        pieceId: pieceIdSchema.optional(),
        clientSeq: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const undoSchema = z
  .object({
    type: z.literal("undo"),
    data: z
      .object({
        matchId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        clientSeq: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const submitFinishSchema = z
  .object({
    type: z.literal("submitFinish"),
    data: z
      .object({
        matchId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        clientSeq: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const requestSyncSchema = z
  .object({
    type: z.literal("requestSync"),
    data: z.object({ matchId: z.string().min(1) }).strict(),
  })
  .strict();

const listRoomsSchema = z
  .object({
    type: z.literal("listRooms"),
    data: z.object({}).strict(),
  })
  .strict();

export const ClientEventSchema = z.discriminatedUnion("type", [
  joinRoomSchema,
  leaveRoomSchema,
  readySchema,
  kickPlayerSchema,
  updateSettingsSchema,
  startMatchSchema,
  placePieceSchema,
  removePieceSchema,
  undoSchema,
  submitFinishSchema,
  requestSyncSchema,
  listRoomsSchema,
]);

const roomStateSchema = z
  .object({
    type: z.literal("roomState"),
    data: z
      .object({
        roomCode: z.string().min(4),
        players: z.array(
          z
            .object({
              playerId: z.string().min(1),
              name: z.string().min(1),
              connected: z.boolean(),
              ready: z.boolean(),
            })
            .strict(),
        ),
        hostId: z.string().min(1),
        settings: matchSettingsSchema,
        visibility: z.enum(["public", "private"]),
        status: roomStatusSchema,
        you: z
          .object({
            playerId: z.string().min(1),
            resumeToken: z.string().min(8),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const lobbyStateSchema = z
  .object({
    type: z.literal("lobbyState"),
    data: z
      .object({
        rooms: z.array(
          z
            .object({
              roomCode: z.string().min(4),
              hostName: z.string().min(1),
              playerCount: z.number().int().min(1),
              maxPlayers: z.number().int().min(1),
              status: roomStatusSchema,
              settings: matchSettingsSchema,
              visibility: z.enum(["public", "private"]),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

const matchStartSchema = z
  .object({
    type: z.literal("matchStart"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        startTime: z.number().int(),
        rounds: z.array(roundDefSchema),
        countdownMs: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

const roundStartSchema = z
  .object({
    type: z.literal("roundStart"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        playerId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        puzzleId: z.string().min(1),
        startTime: z.number().int(),
      })
      .strict(),
  })
  .strict();

const playerStateSchema = z
  .object({
    type: z.literal("playerState"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        playerId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        placedPieces: z.array(piecePlacementSchema),
        remainingPieceIds: z.array(pieceIdSchema),
        boardFilledCount: z.number().int().min(0),
        lastAppliedSeq: z.number().int().min(0),
        finishedAt: z.number().int().optional(),
        splitMs: z.number().int().min(0).optional(),
      })
      .strict(),
  })
  .strict();

const actionRejectedSchema = z
  .object({
    type: z.literal("actionRejected"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        clientSeq: z.number().int().positive(),
        reason: actionRejectedReasonSchema,
        authoritativeState: z
          .object({
            roundIndex: z.number().int().min(0),
            placedPieces: z.array(piecePlacementSchema),
            remainingPieceIds: z.array(pieceIdSchema),
            lastAppliedSeq: z.number().int().min(0),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const playerFinishedSchema = z
  .object({
    type: z.literal("playerFinished"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        playerId: z.string().min(1),
        roundIndex: z.number().int().min(0),
        finishedAt: z.number().int(),
        splitMs: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

const winnerDecidedSchema = z
  .object({
    type: z.literal("winnerDecided"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        winnerId: z.string().min(1),
        decidedAt: z.number().int(),
        lockInMs: z.number().int().min(0),
        lockEndsAt: z.number().int(),
      })
      .strict(),
  })
  .strict();

const matchResultSchema = z
  .object({
    type: z.literal("matchResult"),
    data: z
      .object({
        roomCode: z.string().min(4),
        matchId: z.string().min(1),
        winnerId: z.string().min(1),
        placements: z.array(
          z
            .object({
              playerId: z.string().min(1),
              place: z.number().int().min(1),
              roundsCompleted: z.number().int().min(0),
              finalFinishAt: z.number().int().optional(),
              status: z.enum(["finished", "dnf"]),
            })
            .strict(),
        ),
        splitsByPlayer: z.record(
          z.array(z.number().int().min(0).nullable()),
        ),
        winnerBoards: z.array(
          z
            .object({
              roundIndex: z.number().int().min(0),
              puzzleId: z.string().min(1),
              placedPieces: z.array(piecePlacementSchema),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

const stateSyncSchema = z
  .object({
    type: z.literal("stateSync"),
    data: z
      .object({
        roomCode: z.string().min(4),
        now: z.number().int(),
        status: roomStatusSchema,
        hostId: z.string().min(1),
        settings: matchSettingsSchema,
        visibility: z.enum(["public", "private"]),
        match: matchStateSchema.optional(),
        players: z.array(
          z
            .object({
              playerId: z.string().min(1),
              name: z.string().min(1),
              connected: z.boolean(),
              currentRoundIndex: z.number().int().min(0),
              splitsMs: z.array(z.number().int().nullable()),
              lastAppliedSeq: z.number().int().min(0),
              round: z
                .object({
                  roundIndex: z.number().int().min(0),
                  puzzleId: z.string().min(1),
                  startedAt: z.number().int(),
                  finishedAt: z.number().int().optional(),
                  placedPieces: z.array(piecePlacementSchema),
                  remainingPieceIds: z.array(pieceIdSchema),
                  boardFilledCount: z.number().int().min(0),
                })
                .strict()
                .optional(),
            })
            .strict(),
        ),
        you: z
          .object({
            playerId: z.string().min(1),
            resumeToken: z.string().min(8),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const errorSchema = z
  .object({
    type: z.literal("error"),
    data: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ServerEventSchema = z.discriminatedUnion("type", [
  lobbyStateSchema,
  roomStateSchema,
  matchStartSchema,
  roundStartSchema,
  playerStateSchema,
  actionRejectedSchema,
  playerFinishedSchema,
  winnerDecidedSchema,
  matchResultSchema,
  stateSyncSchema,
  errorSchema,
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export type ClientJoinRoomEvent = z.infer<typeof joinRoomSchema>;
export type ClientActionEvent =
  | z.infer<typeof placePieceSchema>
  | z.infer<typeof removePieceSchema>
  | z.infer<typeof undoSchema>
  | z.infer<typeof submitFinishSchema>;

export type ServerRoomStateEvent = z.infer<typeof roomStateSchema>;
export type ServerStateSyncEvent = z.infer<typeof stateSyncSchema>;
export type ServerPlayerStateEvent = z.infer<typeof playerStateSchema>;

export type SharedRoomStatus = RoomStatus;
export type SharedMatchSettings = MatchSettings;
export type SharedPiecePlacement = PiecePlacement;
export type SharedRoundDef = RoundDef;
export type SharedMatchState = MatchState;
export type SharedActionRejectedReason = ActionRejectedReason;
export type SharedMatchPlacement = MatchPlacement;

export const parseClientEvent = (payload: unknown): ClientEvent =>
  ClientEventSchema.parse(payload);

export const safeParseClientEvent = (payload: unknown) =>
  ClientEventSchema.safeParse(payload);

export const parseServerEvent = (payload: unknown): ServerEvent =>
  ServerEventSchema.parse(payload);

export const safeParseServerEvent = (payload: unknown) =>
  ServerEventSchema.safeParse(payload);
