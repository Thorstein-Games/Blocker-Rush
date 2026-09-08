# Blocker Rush — independent Impeccable design assessment A

Target: `apps/web/components/DailyGame.tsx` and shared game UI. Assessment A completed independently of detector output. Method: official Impeccable v4.2.2 skill and critique reference; source inspection; visual inspection of root-captured screenshots `01-daily-before.png` through `05-small-phone-before.png`. No product edits or browser interaction by this assessor.

## Judgment

**Design specificity: PASS, with excess container chrome.** The colored polyominoes, crossed blocker cells, dark tabletop, and compact arcade wordmark belong to this game. Keep that identity. The biggest opportunity is to make the first successful placement self-explanatory. Desktop spends substantial visual space on metadata; mobile removes almost all context. Neither gives a newcomer the win condition beside the board.

The requested square corners and tighter cell spacing are the right refinement: the former soft, separated cells read as individual buttons instead of solid pieces. The parent has now implemented this; remaining findings below describe the captured pre-change interface and source behavior, and need not be conflated with the requested CSS fix.

## Diagnostic heuristic scores

Scores concern the inspected UI, not measured usability outcomes. 0 = absent/broken; 4 = excellent. All ten apply to this interactive game.

| Heuristic | Score | Evidence |
|---|---:|---|
| Visibility of system status | 2 | Desktop daily status is clear; current mode/date disappear on phone and invalid placements have no reason text. |
| Match with real world | 3 | Tangible pieces and crossed blockers are intuitive; the goal itself is hidden in Help. |
| User control and freedom | 2 | Pieces can be moved/removed; Clear has no exposed Undo. |
| Consistency and standards | 3 | Shared board, colors and controls across modes; shortcut handling is only partial keyboard support. |
| Error prevention | 2 | Invalid placements are rejected, but clearing all progress is a single adjacent control. |
| Recognition over recall | 2 | Nine shapes remain visible; rotation/removal rules require recalling a separate help panel. |
| Flexibility and efficiency | 1 | Pointer, touch, and rotation shortcuts exist; selection and placement are not keyboard operable in source. |
| Aesthetic and minimalist design | 3 | Strong game focus and material identity; sidebar cards and tall tray weaken desktop composition. |
| Error recovery | 1 | Manual removal exists, but there is no undo command and rejected placements return silently. |
| Help and documentation | 2 | Correct, substantial help exists; a seven-item interaction list teaches through recall rather than practice. |
| **Total** | **21/40** | Several useful foundations; first-run clarity, recovery, and keyboard operation need work. |

## What works

- The board is the largest visual object and is encountered immediately. No menu or marketing screen delays play.
- Blockers combine an X, stripe pattern, and different material. They are distinguishable without relying on hue alone.
- All nine piece shapes are visible at once on the inspected phone layouts. Their consistent colors and spatial forms support puzzle reasoning; keep all nine available.

## Priority findings

1. **[P1] Keyboard users cannot perform the central task.** Code observation: piece buttons only invoke `onPointerDown` (`PiecesTray.tsx:117–124`); board cells are non-focusable divs (`GameBoard.tsx:63–75`) and the board has pointer/click handlers only (`GameBoard.tsx:95–100`). Global shortcuts rotate/flip an already active piece (`GameContext.tsx:294–316`). Fix: support Enter/Space selection, board cell focus/navigation and keyboard placement, plus visible focus. Suggested command: `impeccable audit` / `harden`. This was not separately browser-playtested by A.

2. **[P2] First-time players receive mechanics without a visible objective or current mode.** Screenshot observation: phone shows the board and “Tap or drag a piece,” but no Daily label, date, or instruction to fill every empty square. Help capture contains seven interaction bullets plus modes. Source: `GameHeader.tsx:71–109`; `DailyGame.tsx:298–307`; mobile hides `.header-center` in `globals.css:1106`. Fix: a small Daily/date line and one sentence beside the board (“Fill every empty square with all 9 pieces”), then contextual rotate/flip/removal hints after selection. Suggested command: `impeccable onboard` / `clarify`.

3. **[P2] Errors lack a clear recovery path.** Code observation: Clear immediately replaces all placed pieces with an empty board (`GameContext.tsx:348–362`); history is recorded but no undo API/button exists. Invalid click placement returns at `GameContext.tsx:915`; only valid ghosts render at `GameBoard.tsx:109`. Fix: expose Undo and offer a brief reason for invalid placement, using board-local feedback without interrupting play. Suggested command: `impeccable harden`. Do not describe silent rejection as browser-tested by A.

4. **[P2] Desktop devotes too much structure to secondary information.** Screenshot `02-desktop-before.png`: four individual stats cards occupy the left column while the board sits right of viewport center; at 1280×900 the tray’s bottom edge is below the viewport, although its last piece row is visible. Source: `DailyGame.tsx:242–260,298–304`; `globals.css:517–523,546–559,873–883`. Fix: combine date/difficulty/streak into a compact strip aligned with the board and tune tray height around complete board-plus-tray visibility. Suggested command: `impeccable layout` / `distill`.

5. **[P2] Small-phone header overlaps its own title.** Confirmed in `05-small-phone-before.png` at 320×740: Help sits over the final part of the wordmark. Source: `.header-left` claims full width while `.header-actions` is absolute at right (`globals.css:1101–1114`). Fix: reserve a real header grid column for actions and reduce/hide only the wordmark text at the narrowest breakpoint. Suggested command: `impeccable adapt`.

## Cognitive load and persona lenses

**Two failures out of eight checks:** working-memory support and progressive disclosure. Core rules live in a separate modal; the tutorial presents seven interaction rules together. The nine visible pieces are intentional puzzle complexity, not an interface-choice defect. Do not hide them to satisfy a numerical four-choice rule. Desktop grouping/hierarchy is a refinement issue, not a catastrophic attention failure.

- **New player:** sees attractive pieces but must open Help to understand the win condition, then remember placement, rotation and removal gestures while playing.
- **Returning phone player:** can reach the pieces immediately, but cannot see Daily versus Casual from the closed header; narrow header collision damages legibility.
- **Keyboard player:** can tab to a labeled piece button but its keyboard activation has no selection handler; cannot reach a board cell to place it. This lens is supported by source, not an observed user test.

## Emotional journey and smaller observations

The opening is inviting and tactile. Likely valleys are the first silent failed placement and an accidental Clear. Completion is explicitly celebrated in `GameBoard.tsx:173–187`, but A did not inspect a solved screenshot, so celebration quality is unverified.

Code-derived follow-ups: the flex tray removes pieces while dragging/placed (`PiecesTray.tsx:92–95`), so surviving pieces can reflow; test whether this disrupts spatial memory. Casual hints name board coordinates (`CasualGame.tsx:322–333`) while the shared board renders no visible axes (`GameBoard.tsx:63–75`); a board-local highlight would make hints usable without coordinate translation. “Not yet cleared” and “Board cleared” are less literal than “Not yet solved” for a task whose goal is to fill the board. The live grid background is visually subordinate in still captures; animation distraction/performance was not assessed here.

Questions skipped: the user already supplied a concrete refinement request; broader product decisions can be addressed after reviewing these findings.

References consulted: https://impeccable.style/tutorials/getting-started/ ; https://impeccable.style/docs/critique/ ; https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/SKILL.md ; https://raw.githubusercontent.com/pbakaus/impeccable/main/.agents/skills/impeccable/reference/critique.md
