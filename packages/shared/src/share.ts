import type { Coordinate, PieceId } from "./types";
import { DEFAULT_BOARD, coordToVec, parsePuzzleId, toIndex } from "./coords";
import { PIECE_TRANSFORMS } from "./pieces";

const pieceEmoji = (pieceId: PieceId): string => {
  const tokens: Record<PieceId, string> = {
    p1: "🟥",
    p2: "🟧",
    p3: "🟨",
    p4: "🟩",
    p5: "🟦",
    p6: "🟪",
    p7: "🟫",
    p8: "⬜",
    p9: "🟫",
  };
  return tokens[pieceId];
};

type ShareOptions = {
  revealPieceCount?: number;
  messageText?: string;
};

const filterPlacements = (
  placements: Record<
    PieceId,
    { origin: { x: number; y: number }; transformId: string } | undefined
  >,
  revealPieceCount?: number,
) => {
  if (!revealPieceCount || revealPieceCount <= 0) {
    return placements;
  }

  const revealed = Object.entries(placements)
    .filter(
      (entry): entry is [PieceId, NonNullable<(typeof placements)[PieceId]>] =>
        Boolean(entry[1]),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, revealPieceCount);

  const next = { ...placements };
  for (const pieceId of Object.keys(next) as PieceId[]) {
    next[pieceId] = undefined;
  }
  for (const [pieceId, placement] of revealed) {
    next[pieceId] = placement;
  }
  return next;
};

export const renderAsciiBoard = (
  blockers: Coordinate[],
  placements: Record<
    PieceId,
    { origin: { x: number; y: number }; transformId: string } | undefined
  >,
  options: ShareOptions = {},
): string => {
  const filteredPlacements = filterPlacements(
    placements,
    options.revealPieceCount,
  );
  const size = DEFAULT_BOARD;
  const cells: (string | null)[] = Array.from(
    { length: size.cols * size.rows },
    () => null,
  );
  for (const blocker of blockers) {
    const vec = coordToVec(blocker);
    const idx = toIndex(size, vec);
    cells[idx] = "🔲";
  }
  for (const [pieceId, placement] of Object.entries(filteredPlacements)) {
    if (!placement) continue;
    const transforms = PIECE_TRANSFORMS[pieceId as PieceId];
    const transform = transforms.find(
      (item) => item.id === placement.transformId,
    );
    if (!transform) continue;
    for (const cell of transform.cells) {
      const x = placement.origin.x + cell.x;
      const y = placement.origin.y + cell.y;
      const idx = y * size.cols + x;
      cells[idx] = pieceEmoji(pieceId as PieceId);
    }
  }

  const rows: string[] = [];
  for (let y = 0; y < size.rows; y += 1) {
    const row = [];
    for (let x = 0; x < size.cols; x += 1) {
      const idx = y * size.cols + x;
      row.push(cells[idx] ?? "⬛");
    }
    rows.push(row.join(""));
  }
  return rows.join("\n");
};

export const buildShareText = (
  puzzleId: string,
  placements: Record<
    PieceId,
    { origin: { x: number; y: number }; transformId: string } | undefined
  >,
  originUrl: string,
  options: ShareOptions = {},
): string => {
  const ascii = renderAsciiBoard(parsePuzzleId(puzzleId), placements, options);
  const url = `${originUrl}?p=${puzzleId}`;
  const msg = options.messageText ?? "Play Blocker Rush!";
  return [msg, "", ascii, "", url].join("\n");
};
