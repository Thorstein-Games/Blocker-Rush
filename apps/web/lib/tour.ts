/*
 * Blocker Rush's first-run tutorial: the tray (pick, rotate, flip), the board
 * (tap to place), then the header. The overlay is the shared `tutorial.ts`.
 */
import { autoTutorial, openTutorial, type TutorialOptions } from "./tutorial";

export const TUTORIAL_KEY = "blockerRush.tutorial";

/*
 * Two looping pictures, drawn to match the real board and tray: a piece being
 * turned (Rotate, then Flip), and a tap on the board dropping a piece over
 * the tapped square. With reduced motion they hold still on the end state.
 */
const cells = (on: number[], cls = "") =>
  Array.from({ length: 9 }, (_, i) => `<i${on.includes(i) ? ` class="on${cls}"` : ""}></i>`).join("");

const TURN_ART = `<div class="br-art" aria-hidden="true">
  <div class="br-slot"><span class="br-piece">${cells([0, 3, 6, 7])}</span></div>
  <div class="br-keys"><span class="br-key rot">Rotate</span><span class="br-key flip">Flip</span></div>
</div>`;

const PLACE_ART = `<div class="br-art place" aria-hidden="true">
  <div class="br-board">
    ${Array.from({ length: 9 }, (_, i) =>
      i === 0 ? `<i class="x"></i>` : `<i class="${[3, 4, 6, 7].includes(i) ? "drop" : ""}${i === 7 ? " tap" : ""}"></i>`,
    ).join("")}
  </div>
  <p class="br-cap">Tap a square: the piece covers it.</p>
</div>`;

const CSS = `
.br-art { display: grid; justify-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: #151b1a; border: 1px solid rgba(255,255,255,.1); }
.br-slot { width: 96px; height: 96px; display: grid; place-items: center; border-radius: 12px; border: 2px solid #f2c14e; background: rgba(242,193,78,.12); }
.br-piece { display: grid; grid-template-columns: repeat(3, 18px); gap: 2px; animation: br-turn 6s ease-in-out infinite; }
.br-piece i, .br-board i { border-radius: 3px; }
.br-piece i { width: 18px; height: 18px; }
.br-piece i.on { background: #4a86f7; box-shadow: inset 0 -2px 0 rgba(0,0,0,.25); }
.br-keys { display: flex; gap: 8px; }
.br-key { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.22); color: #e4e5ea; font: 650 14px system-ui, sans-serif; }
.br-key.rot { animation: br-rot 6s infinite; } .br-key.flip { animation: br-flip 6s infinite; }
@keyframes br-turn {
  0%, 18% { transform: none; } 28%, 48% { transform: rotate(90deg); }
  58%, 82% { transform: rotate(90deg) scaleY(-1); } 92%, 100% { transform: none; }
}
/* Each button lights up while the piece turns; a hard switch, so the label never fades through dark on dark. */
.br-key.rot, .br-key.flip { animation-timing-function: steps(1, end); }
@keyframes br-rot { 0%, 17% { background: none; color: #e4e5ea; } 18%, 30% { background: #f2c14e; color: #1b2422; border-color: #f2c14e; } 31%, 100% { background: none; color: #e4e5ea; } }
@keyframes br-flip { 0%, 47% { background: none; color: #e4e5ea; } 48%, 60% { background: #f2c14e; color: #1b2422; border-color: #f2c14e; } 61%, 100% { background: none; color: #e4e5ea; } }
.br-board { display: grid; grid-template-columns: repeat(3, 40px); gap: 4px; padding: 6px; border-radius: 10px; background: #0f1312; }
.br-board i { position: relative; width: 40px; height: 40px; background: #232a3a; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
.br-board i.x { background: #121615; box-shadow: inset 0 0 0 1px rgba(242,193,78,.45); }
.br-board i.x::before, .br-board i.x::after { content: ""; position: absolute; left: 20%; right: 20%; top: 50%; height: 3px; background: #b8923f; border-radius: 2px; }
.br-board i.x::before { transform: rotate(45deg); } .br-board i.x::after { transform: rotate(-45deg); }
.br-board i.drop { animation: br-drop 4s infinite; }
.br-board i.tap::after { content: ""; position: absolute; inset: 8px; border-radius: 50%; border: 3px solid #fff; opacity: 0; animation: br-tap 4s infinite; }
@keyframes br-tap { 10% { opacity: 0; transform: scale(1.4); } 20%, 30% { opacity: 1; transform: scale(1); } 38%, 100% { opacity: 0; } }
@keyframes br-drop { 0%, 32% { background: #232a3a; transform: none; } 36% { background: #4a86f7; transform: scale(1.08); } 42%, 88% { background: #4a86f7; transform: none; } 100% { background: #232a3a; } }
.br-cap { margin: 0; font-size: 13px; color: #a9abb6; }
/* On a phone the board itself takes most of the screen; the card leaves the picture out so it doesn't cover the board. */
@media (max-width: 600px) and (max-height: 900px) { .br-art.place { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .br-piece, .br-key, .br-board i, .br-board i.tap::after { animation: none !important; }
  .br-board i.drop { background: #4a86f7; }
}
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
        title: "Pick a piece",
        body: "Tap a piece here to pick it. Tap it again, or use Rotate and Flip, to turn it until it fits. Undo, Clear and Hint are here too.",
        target: ".pieces-area",
        art: TURN_ART,
      },
      {
        title: "Fill every square",
        body: "Tap the board to place the piece: it covers the square you tap. Fill every square but the crossed blockers. Double-tap a piece to take it back.",
        target: ".board",
        art: PLACE_ART,
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
