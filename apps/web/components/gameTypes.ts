import type { PieceId, Vec2 } from "@blocker-rush/shared";

export type PieceState = { rotation: number; flipped: boolean };

export type DragGhost = {
  origin: Vec2;
  valid: boolean;
};

export type PieceColors = Record<PieceId, string>;
