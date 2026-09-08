# Blocker Rush technical design audit

Reviewed 2026-09-07. Scope: Daily, Casual, shared game controls, multiplayer lobby/shared game components, theme and animation source. Impeccable's five-dimension audit format and P0–P3 priority scale informed this review: https://impeccable.style/docs/audit/. Root captured browser evidence; this subagent reviewed source and the Daily 552px and 320px screenshots. Multiplayer live matches, screen reader behavior, interaction latency, and computed contrast were not independently tested here.

## Directional scores

These are reviewer judgments, not automated compliance or performance results.

| Dimension | Score / 4 | Evidence and confidence |
|---|---:|---|
| Accessibility | 1 | High confidence: core game is pointer-only, shortcuts intercept editing keys, modal focus management is absent. Native buttons, labels, Escape closing, and blocker X marks are useful foundations. |
| Performance | 2.5 | Medium confidence: background repaints continuously while idle; drag uses requestAnimationFrame and transforms; no timing profile was captured. |
| Theming | 3 | Medium confidence: light/dark/system tokens cover major surfaces; no theme-breaking defect established. No computed contrast sweep or flash measurement. |
| Responsive | 2.5 | High confidence for 320px header overlap; narrow board stays within viewport. Larger layouts require root's screenshot synthesis. |
| Anti-patterns | 3 | Source detector reports one repeated stylistic font concern; shared block styling and geometry tokens are solid. New documentation is missing, not a release blocker. |

No P0 identified. Three P1, five P2, and one optional P3 findings follow. Radius/gap appearance changes requested by the user are being handled separately by root and are not counted as unresolved technical defects.

## Findings

### P1 — Core puzzle cannot be played with the keyboard

**Evidence:** `apps/web/components/PiecesTray.tsx:117–125` renders named native buttons, but selection is implemented only by `onPointerDown` at line 121. Enter/Space dispatch click, which has no handler. `apps/web/components/GameBoard.tsx:64–75` and `:95–107` render unlabeled, unfocusable div cells and a pointer/click-only board. D/S/F shortcuts only transform an already active piece.

**Impact:** A keyboard player cannot select a piece and cannot choose a placement square; a screen reader has no grid coordinate/occupancy description.

**Remedy:** Add keyboard activation for tray selection; provide a focusable grid cursor with arrow movement and Enter placement, and a clear remove/cancel interaction. Expose each square's coordinate and state and announce placement results. Keep pointer behavior while making the same game operations available from keyboard.

**Verification:** Tab to a tray piece, press Enter, navigate the board, place and remove a piece without using a pointer. Test a complete puzzle using a screen reader/keyboard combination.

### P1 — Game shortcuts steal input and native-control keys

**Evidence:** `apps/web/components/GameContext.tsx:294–315` listens at window scope and prevents default for D, S, F and all four arrow keys whenever `activePieceId` exists. It never checks event target, `contentEditable`, modifiers, dialog state, or focus location. Casual exposes a Puzzle ID text input at `apps/web/components/CasualGame.tsx:382` .

**Impact:** After selecting a piece, entering a puzzle ID containing D/F can mutate the piece and omit typed characters; arrow keys used for caret movement or native selects can operate the game instead. The same issue reaches theme controls in modal dialogs.

**Remedy:** Scope shortcuts to the active game surface and ignore editable targets, native inputs/selects, composition, modified key combinations, and open modal contexts. Add focused regression coverage for D/F in the Puzzle ID field after selection.

### P1 — Dialog semantics lack the corresponding focus behavior

**Evidence:** `apps/web/components/GameHeader.tsx:126–136` only implements Escape closing. `:328–359` sets `role="dialog"` and `aria-modal="true"`, but never focuses the dialog, traps focus, makes the background inert, or restores trigger focus.

**Impact:** Opening Help, Stats, or Settings can leave focus behind the visible modal and allow Tab to reach background navigation/game controls. Screen reader modal semantics do not match keyboard behavior.

**Remedy:** Use a native dialog or accessible dialog primitive with initial focus, focus containment, background inertness, Escape closing, and trigger focus restoration.

### P2 — Header actions overlap the brand on a 320px screen

**Evidence:** `artifacts/design-audit/05-small-phone-before.png` visibly shows Help/Stats/Settings covering the end of “BLOCKER RUSH.” In `apps/web/app/globals.css:1108`, mobile `.header-actions` are absolutely positioned to the right while `.header-left` occupies full width. Root measured no document horizontal overflow: the 320px board shell lies approximately x6.2–313.8.

**Impact:** Narrow phones lose a clean title/action hierarchy even though the board itself remains usable.

**Remedy:** Reserve explicit grid columns for brand/actions and let the title abbreviate or wrap at the narrow breakpoint; consider a single compact utility menu. Do not shrink the board further to solve a header-only issue.

**Verification:** 320px and 375px screenshots with all three utility actions present and text enlarged. This is not reported as a touch-target conformance failure: the measured 32–36px controls exceed 24px, though 44px remains a useful comfort target.

### P2 — Reduced-motion preference is incomplete

**Evidence:** `apps/web/components/multiplayer/WinnerFireworks.tsx:35–46` always starts the particle effect; it runs for five seconds (`:81–85`). `apps/web/app/globals.css:1022–1036` runs the celebration flare indefinitely. There is no corresponding reduced-motion override in globals. `apps/web/app/multiplayer/multiplayer.css:294–297` disables only countdown animation. Background code checks reduced motion for the pointer glow but continues pointer trails/fades.

**Impact:** A player requesting reduced motion still receives animated celebration and background effects.

**Remedy:** Under reduced motion, use a static success treatment, skip particle spawning, remove the flare, and render a static background. Keep the existing clear completion message.

### P2 — Decorative background repaints the full viewport at idle

**Evidence:** `apps/web/components/background/InteractiveGridBackground.tsx:279–288` unconditionally clears and redraws the grid, pointer glow, and active cells before requesting the next frame; there is no idle stop when active cells decay to zero. `:84–95` caps DPR at 2, which is a useful safeguard.

**Impact:** This produces continuous canvas work even when no gameplay or background state changes. Battery/latency impact has not been profiled, so no FPS or millisecond claim is made.

**Remedy:** Make the stationary grid CSS or cache it, schedule frames only while trails animate, redraw on resize/theme changes, and stop when idle. Profile a low-power phone before changing other gameplay rendering.

### P2 — Invalid placements and state changes have little accessible feedback

**Evidence:** `apps/web/components/GameContext.tsx:915` silently returns on an invalid click placement; `apps/web/components/GameBoard.tsx:109` renders only a valid ghost. Completion and share notices in `apps/web/components/DailyGame.tsx:311` / `:334` and `apps/web/components/CasualGame.tsx:426` / `:466` use plain divs without status/live semantics.

**Impact:** Failed placement can look like an ignored tap, while assistive technology receives no equivalent state update.

**Remedy:** Give brief visible feedback for a rejected placement (occupied, blocker, or edge), expose a polite status region for selected piece/placement/solve/share outcomes, and avoid announcing every pointermove.

### P2 — Multiplayer names and private room codes lack persistent labels

**Evidence:** `apps/web/components/multiplayer/MultiplayerLobbyLanding.tsx:129–134` has only the Display name placeholder. The per-room private code input at `:254–263` also has only a Code placeholder. The main Room code and rounds fields are properly labeled.

**Impact:** Once populated, these inputs lose their visible purpose; repeated private-room fields lack a clear association with their room.

**Remedy:** Add visible labels with input IDs and room context, retaining placeholders only as examples.

### P3 — Font warning is optional brand polish

The official source detector found three occurrences of its `overused-font` rule for Space Grotesk (`apps/web/app/globals.css:1`, `:175`, `:215`). This is one repeated aesthetic concern, not three independent defects or an accessibility finding. Oxanium already provides a game-specific title voice. Keep Space Grotesk if the resulting hierarchy is intentional; choose another UI face only as part of a broader brand decision.

## Official Impeccable tooling evidence

- Verified npm `impeccable@4.0.4` points to `https://github.com/pbakaus/impeccable.git`.
- Ran `impeccable detect --json apps/web`; exit 2 means findings, and the report is valid JSON with only the three Space Grotesk warnings. Raw output: `/tmp/blocker-impeccable-detector.json`.
- This was a source scan, not the detector's rendered-page mode. Source scanning does not establish keyboard, contrast, or responsive conformance. Detector documentation: https://impeccable.style/docs/detector/.
- npm emitted an engine advisory: package requires Node >=22.18.0 while this shell has 22.17.1. The scan itself completed. No global hooks or project dependencies were installed; cache lives under `/tmp/blocker-impeccable-npm`.
- Ran `impeccable context` from `apps/web` after root invocation requested monorepo target selection. It found no PRODUCT.md/DESIGN.md and an existing visual system; scoped refinement is allowed. Context output: `/tmp/blocker-impeccable-context.txt`.
- Root should rerun the same cached detector over final changed CSS after the spacing/radius edit; the audit scan above preceded those changes.

## Geometry notes for root

Board/ghost/drag use computed gaps through shared board metrics and CSS variables. Tightening gap values consistently is appropriate. Radius overrides existed in the tray, mobile cells, drag preview, and mini-board styles, so changing the root radius alone would have left inconsistent rounded blocks. Root reports removing those overrides as part of the user's requested fix.
