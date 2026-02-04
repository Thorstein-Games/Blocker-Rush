import type { Coordinate, PieceId } from "./types";
import { DEFAULT_BOARD, coordToVec, parsePuzzleId, toIndex } from "./coords";
import { PIECE_TRANSFORMS } from "./pieces";

const pieceToken = (pieceId: PieceId): string => {
  const index = Number.parseInt(pieceId.replace("p", ""), 10);
  return Number.isFinite(index) ? String(index) : "?";
};

export const renderAsciiBoard = (
  blockers: Coordinate[],
  placements: Record<PieceId, { origin: { x: number; y: number }; transformId: string } | undefined>
): string => {
  const size = DEFAULT_BOARD;
  const cells: (string | null)[] = Array.from(
    { length: size.cols * size.rows },
    () => null
  );
  for (const blocker of blockers) {
    const vec = coordToVec(blocker);
    const idx = toIndex(size, vec);
    cells[idx] = "#";
  }
  for (const [pieceId, placement] of Object.entries(placements)) {
    if (!placement) continue;
    const transforms = PIECE_TRANSFORMS[pieceId as PieceId];
    const transform = transforms.find((item) => item.id === placement.transformId);
    if (!transform) continue;
    for (const cell of transform.cells) {
      const x = placement.origin.x + cell.x;
      const y = placement.origin.y + cell.y;
      const idx = y * size.cols + x;
      cells[idx] = pieceToken(pieceId as PieceId);
    }
  }

  const rows: string[] = [];
  for (let y = 0; y < size.rows; y += 1) {
    const row = [];
    for (let x = 0; x < size.cols; x += 1) {
      const idx = y * size.cols + x;
      row.push(cells[idx] ?? ".");
    }
    rows.push(row.join(" "));
  }
  return rows.join("\n");
};

export const buildShareText = (
  puzzleId: string,
  placements: Record<PieceId, { origin: { x: number; y: number }; transformId: string } | undefined>,
  originUrl: string
): string => {
  const ascii = renderAsciiBoard(parsePuzzleId(puzzleId), placements);
  const url = `${originUrl}?p=${puzzleId}`;
  return [
    "Blocker Rush",
    `Puzzle: ${puzzleId}`,
    "",
    ascii,
    "",
    `Solve: ${url}`,
  ].join("\n");
};
