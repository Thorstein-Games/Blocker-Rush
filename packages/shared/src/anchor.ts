import type { Vec2 } from "./types";

/**
 * Anchor cell model for drag & drop.
 * 
 * The anchor is the reference point used during dragging:
 * - It's a specific cell within the piece (in piece-local coordinates)
 * - When dragging, the pointer maps to the anchor position
 * - When snapping, the anchor is what aligns to the grid
 * 
 * For consistency, we choose the top-left-most occupied cell as the anchor.
 * This ensures stable behavior across rotations and flips.
 */

export type AnchorData = {
  /** The anchor cell in piece-local coordinates */
  anchorCell: Vec2;
  /** Pixel offset from piece origin (0,0) to anchor cell center */
  anchorOffsetPx: (cellSize: number, gap: number) => Vec2;
};

/**
 * Compute anchor cell for a piece transform.
 * We use the top-left-most cell (min y, then min x) as the stable anchor.
 */
export function computeAnchorCell(cells: Vec2[]): Vec2 {
  if (cells.length === 0) {
    return { x: 0, y: 0 };
  }
  
  // Find top-left-most cell: minimum y, then minimum x
  let anchor = cells[0]!;
  for (const cell of cells) {
    if (cell.y < anchor.y || (cell.y === anchor.y && cell.x < anchor.x)) {
      anchor = cell;
    }
  }
  
  return { x: anchor.x, y: anchor.y };
}

/**
 * Compute pixel offset from piece origin to anchor cell center.
 * Origin is at (0, 0) in piece-local coordinates.
 * Each cell is cellSize x cellSize with gap between cells.
 */
export function computeAnchorOffset(
  anchorCell: Vec2,
  cellSize: number,
  gap: number,
): Vec2 {
  // Position of anchor cell top-left corner
  const anchorX = anchorCell.x * (cellSize + gap);
  const anchorY = anchorCell.y * (cellSize + gap);
  
  // Center of anchor cell
  return {
    x: anchorX + cellSize / 2,
    y: anchorY + cellSize / 2,
  };
}

/**
 * Create anchor data for a piece transform.
 */
export function createAnchorData(cells: Vec2[]): AnchorData {
  const anchorCell = computeAnchorCell(cells);
  
  return {
    anchorCell,
    anchorOffsetPx: (cellSize: number, gap: number) =>
      computeAnchorOffset(anchorCell, cellSize, gap),
  };
}
