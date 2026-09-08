# Design audit — fixes and verification

Completed September 7, 2026 (verification artifacts use September 8 UTC timestamps).

All ten required findings in the original audit are addressed. The optional font warning is retained as an intentional brand choice, as the audit recommends. Square geometry, piece colors, crossed blockers, and immediate access to play remain the visual foundation.

## Impeccable flow

Used the official v4.2.2 skill and its **harden → onboard → adapt/layout → optimize → polish** references. Ran the cached official context loader for `apps/web/components/GameBoard.tsx`; its `SCOPED_EXISTING_ALLOWED` result permits refinement using existing code as design authority. An independent layout assessor reviewed the original captures and confirmed the final layout; implementation and browser verification were completed by the root agent. The final source detector was refreshed after the independent critique’s smaller follow-ups were implemented.

## Resolution map

| Audit critique | Implemented result | Verification |
|---|---|---|
| P1: Keyboard cannot select or place pieces | Enter/Space selection; roving grid focus; arrows and Home/End; Enter/Space placement; Delete/Backspace removal; Escape cancel; visible focus; row/column occupancy and selected-shape descriptions | Completed an entire nine-piece puzzle using only Tab and keyboard game controls. All 29 non-blocker cells filled. |
| P1: Global shortcuts swallow text/native-control keys | D/S/F scoped to the active game surface; editable targets, selects, modified/composing events, and modal contexts excluded. Arrows navigate the board rather than transforming pieces. | Casual Puzzle ID accepts `df`; ArrowLeft moves its caret. Pointer-selected pieces still respond to D. |
| P1: Modal focus remains behind dialog | Native `showModal()` supplies inert background; explicit initial focus, Tab/Shift+Tab wrapping, Escape, and trigger restoration | Settings, Help, and Stats each pass initial focus, forward/backward containment, and restoration. |
| P2: Mode/objective hidden on phones | Persistent mode/date/difficulty/streak strip, one-sentence objective, contextual selection and recovery guidance, shorter Help with optional keyboard details | Mode and goal visible at 320px and 375px; Help remains scrollable. |
| P2: Silent rejection and no Undo | Board-local polite status explains blocker, overlap, and edge failures; Undo reverses placement, drag, removal, and Clear; multiplayer acknowledgments retain local Undo history | Rejection cases pass; keyboard and pointer removal/Undo, drag Undo, Clear Undo, and multiplayer Undo after acknowledgment pass. |
| P2: Desktop metadata/tray waste space | Daily metadata combined; board beside compact tray on wide screens; Casual adopts the same workspace and moves settings to a dialog below 1200px | Daily board ends at y635 and tray at y450 in a 1366×768 viewport. Fully loaded Casual has tray bottom y450 and settings bottom y570. All nine pieces remain visible. |
| P2: 320px header collision | Explicit brand/actions columns; narrow visual “BR” label with full accessible name; 44px utility targets | No title/action overlap or document overflow at 320, 375, 552, 768, 1280, and 1366px. At 375px with 200% text, the title ends at x211 and actions start at x219; no overflow. |
| P2: Reduced-motion gaps | Static completion treatment, no fireworks spawning, static background without decorative pointer trails | Full solved state has no CSS animation; fireworks canvas stays uninitialized. Pointer events produce no background canvas clears in reduced-motion mode. |
| P2: Continuous background repaint | Stationary grid cached separately; animation frames scheduled only while changing; theme/resize redraws; idle and hidden-page work stops | Same 1200ms measurement: **72 canvas clears before, 0 after**. This measures canvas calls, not device battery life or frame latency. |
| P2: Multiplayer input purposes disappear | Visible display-name label and unique code labels tied to each private room’s host | Two disposable local players verify the room-specific label, join a match, place a piece, and Undo after server acknowledgment. Both return to the lobby. |
| P3: Space Grotesk warning | Kept the established UI font and Oxanium title face, following the audit’s explicit recommendation | Final detector has only the original three instances of `overused-font`; no new mechanical findings. |

## Smaller independent-critique follow-ups

- Tray slots stay in place while dragging and after placement. Placed pieces remain dimmed with a visible “Placed” label; keyboard navigation skips these disabled slots. A browser check confirms unchanged slot layout offsets after placing Dot.
- Casual hints now outline the suggested shape directly on the board. On phones, Hint closes Settings and focuses the target square; Enter places the highlighted piece. The outline follows the selected orientation and disappears when the piece is placed or selection changes. If existing pieces occupy the suggested area, board-local feedback explains the conflict. [Mobile hint evidence](../../output/playwright/design-fixes/casual-hint-375.png).
- Status wording now says “Not yet solved,” completion wording says “Board filled,” and Clear reports “Board emptied.”

## Evidence

- [Desktop Daily](../../output/playwright/design-fixes/daily-1366.png)
- [375px phone](../../output/playwright/design-fixes/daily-375.png) and [320px phone](../../output/playwright/design-fixes/daily-320.png)
- [Light theme](../../output/playwright/design-fixes/light-375.png), [Help](../../output/playwright/design-fixes/help-375.png), and [Casual laptop](../../output/playwright/design-fixes/casual-1366.png)
- [Complete keyboard solve with reduced motion](../../output/playwright/design-fixes/keyboard-solved-reduced-motion.png)
- [Recorded browser results](verification-fixed.json): original failing checks are retained alongside their passing follow-up checks, rather than silently rewritten.
- [Final Impeccable detector](detector-fixed.json)
- [Reusable keyboard-solve verification](verify-keyboard.js): a Playwright CLI `run-code` function. It opens and closes a fresh browser context, derives a solution from the rendered board/shapes, and operates the UI with keyboard events. Pass its contents to `playwright-cli run-code` with the local app running on port 3000.

## Checks and limits

`npm run typecheck` passed across web, server, shared, and protocol workspaces. `npm run build:client` completed successfully; its lint stage reports that ESLint is not installed in this repository. `git diff --check` passed. The source detector returns exit 2 for its existing optional font warnings.

Browser checks used Chromium at six viewport sizes and a narrow viewport equivalent to 200% desktop zoom, with light/dark and reduced-motion preferences. Light utility controls were checked after the theme transition settled: foreground `rgb(27, 36, 34)` against white. No screen-reader session, physical phone test, comprehensive contrast certification, or device performance trace is claimed. Multiplayer validation covers a local two-player match and Undo reconciliation; it is not a network-load or reconnect stress test.

The missing PRODUCT.md/DESIGN.md files are still documentation follow-ups rather than blockers for this refinement. `/impeccable init` can capture that durable context later.
