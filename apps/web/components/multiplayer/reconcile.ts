import type { Placement, PieceId } from "@blocker-rush/shared";

const placementKey = (piece: Placement | undefined): string => {
  if (!piece) return "";
  return `${piece.pieceId}:${piece.transformId}:${piece.origin.x}:${piece.origin.y}`;
};

export const diffPlacements = (
  previous: Record<PieceId, Placement | undefined>,
  current: Record<PieceId, Placement | undefined>,
) => {
  const added: Array<{ pieceId: PieceId; placement: Placement }> = [];
  const removed: PieceId[] = [];
  const moved: Array<{ pieceId: PieceId; placement: Placement }> = [];

  const pieceIds = Object.keys(current) as PieceId[];

  for (const pieceId of pieceIds) {
    const prevPlacement = previous[pieceId];
    const nextPlacement = current[pieceId];
    if (placementKey(prevPlacement) === placementKey(nextPlacement)) {
      continue;
    }

    if (!prevPlacement && nextPlacement) {
      added.push({ pieceId, placement: nextPlacement });
      continue;
    }

    if (prevPlacement && !nextPlacement) {
      removed.push(pieceId);
      continue;
    }

    if (nextPlacement) {
      moved.push({ pieceId, placement: nextPlacement });
    }
  }

  return { added, removed, moved };
};
