/*
 * Blocker Rush's first-run tutorial: fill a tiny board with two pieces, then
 * the tray buttons and the header. The overlay is the shared `tutorial.ts`.
 */
import { autoTutorial, openTutorial, type TutorialDemoApi, type TutorialOptions } from "./tutorial";

export const TUTORIAL_KEY = "blockerRush.tutorial";

type Cell = [number, number];
type DemoPiece = { id: string; name: string; color: string; cells: Cell[] };

const SIZE = 3;
const BLOCKER: Cell = [0, 0];
export const DEMO_PIECES: DemoPiece[] = [
  { id: "o", name: "Square", color: "#4a86f7", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: "j", name: "Hook", color: "#f25f5c", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
];

const key = (r: number, c: number) => `${r},${c}`;

/**
 * Where a piece goes when the player taps (r, c): it covers that square,
 * preferring the piece's middle square, like the real board. Null if it can't fit.
 */
export function placeCovering(piece: DemoPiece, r: number, c: number, taken: Set<string>): Cell[] | null {
  const mid = piece.cells.reduce(([a, b], [x, y]) => [a + x / piece.cells.length, b + y / piece.cells.length], [0, 0]);
  const order = [...piece.cells].sort(
    (p, q) => Math.hypot(p[0] - mid[0], p[1] - mid[1]) - Math.hypot(q[0] - mid[0], q[1] - mid[1]),
  );
  for (const [pr, pc] of order) {
    const at = piece.cells.map(([x, y]) => [x - pr + r, y - pc + c] as Cell);
    if (at.every(([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !taken.has(key(x, y)))) return at;
  }
  return null;
}

/** Pick a piece, tap the board to place it; tap a placed piece to take it back. */
export function fillDemo(mount: HTMLElement, api: TutorialDemoApi): () => void {
  const placed = new Map<string, Cell[]>();
  let selected: string | null = "o";
  let solved = false;
  mount.innerHTML = `<div class="br-wrap">
      <div class="br-board" role="grid" aria-label="Practice board"></div>
      <div class="br-tray" role="group" aria-label="Practice pieces"></div>
    </div>`;
  const board = mount.querySelector<HTMLElement>(".br-board")!;
  const tray = mount.querySelector<HTMLElement>(".br-tray")!;

  const owner = (r: number, c: number) => {
    for (const [id, cells] of placed) if (cells.some(([x, y]) => x === r && y === c)) return id;
    return null;
  };
  const taken = () => {
    const s = new Set([key(...BLOCKER)]);
    for (const cells of placed.values()) cells.forEach(([x, y]) => s.add(key(x, y)));
    return s;
  };

  function tapSquare(r: number, c: number) {
    if (solved) return;
    const id = owner(r, c);
    if (id) {
      placed.delete(id);
      selected = id;
      api.say("Taken back. Pick a piece and try again.");
      return render();
    }
    if (r === BLOCKER[0] && c === BLOCKER[1]) return api.say("That's a blocker: nothing can cover it.");
    const piece = DEMO_PIECES.find((p) => p.id === selected);
    if (!piece) return api.say("Pick a piece first.");
    const at = placeCovering(piece, r, c, taken());
    if (!at) return api.say(`The ${piece.name.toLowerCase()} doesn't fit there.`);
    placed.set(piece.id, at);
    selected = DEMO_PIECES.find((p) => !placed.has(p.id))?.id ?? null;
    if (placed.size === DEMO_PIECES.length) {
      solved = true;
      api.done("Solved! Every square is filled.");
    } else if (!DEMO_PIECES.some((p) => !placed.has(p.id) && fitsAnywhere(p))) {
      api.say("The other piece can't fit now. Tap a placed piece to take it back.");
    } else api.say("Now the other piece.");
    render();
  }

  function fitsAnywhere(piece: DemoPiece) {
    const t = taken();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (placeCovering(piece, r, c, t)) return true;
    return false;
  }

  function render() {
    board.replaceChildren();
    for (let r = 0; r < SIZE; r++) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.className = "br-row";
      for (let c = 0; c < SIZE; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "gridcell");
        const id = owner(r, c);
        const blocker = r === BLOCKER[0] && c === BLOCKER[1];
        b.className = `br-cell${blocker ? " blocker" : ""}`;
        if (id) b.style.background = DEMO_PIECES.find((p) => p.id === id)!.color;
        b.setAttribute(
          "aria-label",
          `Square ${r + 1}, ${c + 1}: ${blocker ? "blocker" : id ? DEMO_PIECES.find((p) => p.id === id)!.name : "empty"}`,
        );
        b.addEventListener("click", () => tapSquare(r, c));
        row.appendChild(b);
      }
      board.appendChild(row);
    }
    tray.replaceChildren(
      ...DEMO_PIECES.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "br-piece";
        b.disabled = placed.has(p.id) || solved;
        b.setAttribute("aria-pressed", String(selected === p.id));
        b.setAttribute("aria-label", `${p.name}${placed.has(p.id) ? " (on the board)" : ""}`);
        const rows = Math.max(...p.cells.map(([x]) => x)) + 1;
        b.innerHTML = `<span class="br-mini" style="grid-template-rows:repeat(${rows},14px)">${[0, 1, 2]
          .slice(0, rows)
          .flatMap((x) =>
            [0, 1].map(
              (y) =>
                `<i style="${p.cells.some(([a, b2]) => a === x && b2 === y) ? `background:${p.color}` : "visibility:hidden"}"></i>`,
            ),
          )
          .join("")}</span>`;
        b.addEventListener("click", () => {
          selected = p.id;
          api.say(`${p.name} picked. Tap the board where it should go.`);
          render();
        });
        return b;
      }),
    );
  }

  render();
  api.say("The square is picked. Tap the board where it should go.");
  return () => {};
}

const CSS = `
.br-wrap { display: flex; gap: 16px; align-items: center; justify-content: center; flex-wrap: wrap; }
.br-board { display: grid; gap: 4px; padding: 6px; border-radius: 12px; background: #161c1b; border: 1px solid rgba(255,255,255,.1); }
.br-row { display: flex; gap: 4px; }
.br-cell {
  width: 52px; height: 52px; border: 0; border-radius: 6px; cursor: pointer; padding: 0;
  background: #2b3546; position: relative; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
}
.br-cell:hover:not(.blocker) { filter: brightness(1.06); outline: 2px solid #f2c14e; }
.br-cell.blocker { background: #121615; cursor: default; box-shadow: inset 0 0 0 1px rgba(242,193,78,.45); }
.br-cell.blocker::before, .br-cell.blocker::after {
  content: ""; position: absolute; left: 20%; right: 20%; top: 50%; height: 3px; background: #b8923f; border-radius: 2px;
}
.br-cell.blocker::before { transform: rotate(45deg); } .br-cell.blocker::after { transform: rotate(-45deg); }
.br-tray { display: flex; gap: 10px; }
.br-piece {
  min-width: 64px; min-height: 64px; padding: 8px; border-radius: 10px; cursor: pointer;
  background: rgba(255,255,255,.06); border: 2px solid rgba(255,255,255,.18); display: grid; place-items: center;
}
.br-piece[aria-pressed="true"] { border-color: #f2c14e; background: rgba(242,193,78,.14); }
.br-piece:disabled { opacity: .25; cursor: default; }
.br-mini { display: grid; grid-template-columns: repeat(2, 14px); gap: 2px; }
.br-mini i { width: 14px; height: 14px; border-radius: 2px; }
`;

function options(): TutorialOptions {
  return {
    key: TUTORIAL_KEY,
    label: "Blocker Rush tutorial",
    accent: "#f2c14e",
    accentText: "#1b2422",
    css: CSS,
    steps: [
      {
        title: "Fill every square",
        body: "Pick a piece, then tap the board: it covers the square you tap. Pieces can't cover the crossed blockers or each other. Tap a placed piece to take it back.",
        demo: fillDemo,
      },
      {
        title: "Turn, flip, or get a hint",
        body: "The real puzzle has 9 pieces. Select one to Rotate or Flip it. Undo and Clear start over, and Hint shows a next move when you're stuck.",
        target: ".pieces-area",
      },
      {
        title: "A new puzzle every day",
        body: "Everyone gets the same daily puzzle, so keep your streak going. Casual and Multiplayer are in the menu, and How to Play, stats and settings are up here.",
        target: ".game-header .header-actions",
      },
    ],
  };
}

/** Has this browser played before (any saved Blocker Rush progress)? */
export function playedBefore(): boolean {
  try {
    // Stats and solve history only: settings, theme and today's board can be written on a first load.
    return ["blockerRush.daily.stats", "blockerRush.daily.history", "blockerRush.casual.stats", "blockerRush.multiplayer.stats"].some(
      (k) => localStorage.getItem(k) !== null,
    );
  } catch {
    return false;
  }
}

/** First visit: show the tutorial; returning players never get it. */
export function autoTour() {
  if (playedBefore()) {
    try {
      localStorage.setItem(TUTORIAL_KEY, "seen");
    } catch {
      /* blocked storage */
    }
    return;
  }
  autoTutorial(options());
}

export const showTour = () => openTutorial(options());
