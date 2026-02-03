# "Genius Square" Rules

The aim of each of the 62,208 possible puzzles is to complete the square using the nine coloured shapes, once the seven ‘blockers’ have been positioned. There may be times when it seems impossible, but there will ALWAYS be at least one solution… and that’s why it’s called The Genius Square!

Each player receives a Genius Square grid and a set of nine coloured shapes, plus seven ‘blocker’ pieces. Roll all seven of the dice together and place a ‘blocker’ piece into the squares matching the seven co-ordinates that appear on the dice. Now race your opponent to fill every other space on the grid using the nine shapes.

There are 62,208 possible combinations in which the dice can fall. Using a specially devised computer programme, we have confirmed that all of them have at least one possible solution. Some combinations will be easy to solve, some much harder. It’s all in the luck of the roll of the dice.

As soon as somebody finishes first, roll the dice and play again! You can play alone and challenge yourself against the clock!

# Blocker Rush Interview

Blocker Rush will contain the same mechanics as Genius Square, but will have more things that make it different (apart from just being online vs in real life).
There will be three game modes:

- Casual: for the solo player who wants to set their own settings, go their own pace, etc.
- Multiplayer: More competitive race to see who finishes first. Up to 20 players can join. Three rounds of puzzles. Once a player finishes a puzzle, they instantly start the next puzzle. First to finish 3 win. Each puzzle gets a little harder.
- Daily challenge: One game each day Sunday to Saturday, with each day raising the difficulty until resetting on Sunday.

## Product intent, “feel,” and what makes it not a clone of Genius Square

1. When the player wins, what emotion do you want: relief, pride, “one more run” adrenaline, or calm mastery?
   "One more run" adrenaline

2. What’s the one “signature moment” you want players to remember (e.g., last piece snaps in + streak bonus, photo-finish vs opponent, dramatic time rewind)?
   Last piece snaps in + streak bonus

3. If you removed racing entirely, what part of the experience still must remain for it to be Blocker-rush?
   The core mechanics of playing ("Genius Square")[https://www.gaminglib.com/blogs/news/how-to-play-genius-square] for one player.

4. Do you want the game to be “fair but brutal” or “always encouraging”? (This affects puzzle selection, hints, and time pressure.)
   Always encouraging when playing solo. Fair but brutal for multiplayer

5. What is your stance on “soft cheating”: should the UI prevent obvious misplacements, or let players make mistakes and learn?
   No cheating

## Puzzle identity and reproducibility (the hidden backbone)

6. Do puzzles need to be shareable as a code/link that reproduces the exact blockers + level + rules version forever?
   There are only (62,208)[https://www.happypuzzle.co.uk/family-puzzles-and-games/the-genius-collection/genius-square] possible conmbinations in which the dice can fall. So yes, each puzzle needs to be shareable. Someone's exact solvable link can just be added as a URL param to be shareable.

7. Do you want “daily puzzle” stability? If yes: should it be global or per-region, and should it respect local midnight?
   Yes, the daily puzzle should respect local midnight

8. Are you okay with rotating puzzle sets over time (to keep things fresh), or must your puzzle IDs remain permanent?
   Puzzle IDs remain permanent

9. If two players or more race, do they always get the same puzzle? If yes, how do you handle latency so it still feels fair?
   During a multiplayer race, they always get the same puzzle. Use best practices when handling latency

## Blockers generation model (dice, randomness, and difficulty)

10. Do you want to replicate physical dice exactly (same faces/odds), or do you want “dice-like” randomness optimized for gameplay?
    The Genius Square dice where specifically made so that the grid was solvable. So replicate the physical dice exactly as Genius Square.

11. Should blockers ever create “tight but solvable” boards where only 1–2 solutions exist, or should multiple solutions be common?
    For solo "casual" mode, the difficulty can be set by the player. For multiplayer, mix it up. For daily challenge, each day is progressing in difficulty.

12. Would you rather guarantee “solvable” by precomputing puzzles, or allow true randomness and solve-check on the fly?
    Guarantee solvable. The dice should only allow solvable puzzles.

13. Do you want difficulty levels to be: based on solver complexity (search depth), based on human friction (how many dead-ends), based on time-to-solve targets, or a mix?
    A mix. Usually the hardest grids only have one solution. See this (list of 800 insanely hard puzzles) [https://github.com/CatchemAL/genius-square/blob/main/data/Genius%20Square%20-%20Insanely%20Hard%20Mode.pdf]

## Piece placement rules and interaction design

14. Should pieces be rotatable only in 90° increments? Are reflections allowed for any pieces?
    Pieces should be rotatable in 90° increments and reflected.

15. Do you want to allow “hover ghost placement” + auto-snapping, or require precise drag?
    Definitely “hover ghost placement” + auto-snapping with the piece above where the finger or mouse is.

16. How strict is the board: can pieces be placed partially outside then rejected, or should placement be impossible outside valid squares?
    Placement should be impossible outside valid squares

17. Do you want “tap to cycle rotations” on mobile, or a dedicated rotate UI?
    Tap to cycle rotations. Press and hold to drag around.

18. What should happen if the player tries to place a piece in an invalid spot: block it completely, allow it but show red overlay, or allow and only validate on “submit”?
    Invalid spots should be blocked completely.

## Hints, verification, and the psychology of help

19. When should validation occur: real-time, on-demand, or only when complete?
    Validation should occur real-time since the puzzle cant even be completed until all pieces are used

20. Should hints be “directional” (e.g., “this piece doesn’t belong there”) or “constructive” (e.g., “try placing piece L in top-left”)?
    Hints should only be on the solo causal mode if enabled. Make them constructive.

21. Do you want a “training wheels” mode that shows all legal placements as you hover? (It’s powerful but can trivialize.)
    No training wheels mode. Causal mode is for learning

22. If a player is stuck, do you want a mechanic like: limited undos, limited peeks, a time penalty for hints, or a rank penalty?
    Every game mode, the player can undo a placed piece, unlimited. In solo mode, there's no penalty for hints if enabled. For multiplayer or dialy challenge mode, there are no hints

23. How do you want to treat near-misses: celebrate progress, or keep it clinical?
    Don't do anything. Be kind and encouraging when the player loses in multiplayer

## Competitive mode (fairness is mostly invisible design)

24. In multiplayer, what is “winning”: first to finish current puzzle, or first to clear a set, or best-of-N?
    First to finish all three puzzles

25. If one player finishes much faster, do they: instantly start next puzzle while other continues, or does the round end and both advance?
    Instantly start the next puzzle.

26. How do you prevent “waiting grief”: player finishes and then just stalls to manipulate matchmaking/levels?
    Use best practices.

27. Do you want synchronous real-time multiplayer, or asynchronous races (ghost times / leaderboards)?
    Real-time multiplayer with web sockets.

28. For real-time multiplayer: are you comfortable with “server-authoritative state,” or would you accept client-authoritative with anti-cheat heuristics?
    Server-authoritative state for real-time multiplayer

## Anti-cheat and trust model (even casual games need a plan)

29. Do you want to hide puzzle definitions client-side to prevent trivial solvers, or accept that users can always reverse-engineer?
    Accept that users can always reverse-engineer

30. Would you rather protect: leaderboards, matchmaking integrity, or puzzle IP / scarcity?
    Doesn't matter. No leaderboards.

31. Do you want to detect impossible completion times and flag them automatically?
    Yes

## Performance constraints (where the game will actually break)

32. Do you want instant responsiveness on low-end phones? What’s your minimum target device/browser?
    Instant responsiveness isn't necessary. Modern browsers only.

33. Should the game work offline (PWA) with local puzzle cache?
    No. We will want to put ads on this game. Leave placeholders somewhere in the UI for a banner.

34. Will you animate piece snapping / celebratory effects? (Animations can conflict with precision interaction.)
    No animations until after the game is complete. Definitely use celebratory effects when a puzzle is completed.

35. Are you okay with heavier computation (solvers) on the client, or must everything remain smooth at 60fps?
    Yes

## Accessibility and inclusivity (beyond “add ARIA”)

36. Are you designing for colorblind users—what’s your plan for conveying collision/invalid placement without relying on red/green?
    No worries with colorblind as the 9 Genius Square pieces are distinct polyomino shapes

37. Keyboard-only: do you want a fully playable mode using arrow keys + rotate + place?
    Yes

38. Screen reader: do you want a simplified “text-mode board,” or is “screen reader support for menus only” acceptable?
    screen reader support for menus only

39. Motion sensitivity: do you need a reduced motion mode for animations?
    no

## Economy, progression, retention (even if free)

40. Is the goal “viral and free,” “subscription puzzle club,” “one-time purchase,” or “sponsored competition”?
    Viral and free with ads

41. If you add cosmetics (themes, pieces skins), should they impact clarity (dangerous) or stay purely decorative?
    No cosmetics

42. Do you want skill-based rating (Elo-like) or simple streak progression?
    Simple streak progression stored in local storage

43. Will you store personal stats? If yes, what’s the player-facing promise about privacy?
    Yes, in local storage

## Legal/branding/IP risk (important given the inspiration)

44. Are you aiming for “inspired by” with original pieces/art/rules, or a faithful digital version?
    "Inspired by" with original art and rules

45. Will you create your own piece set and blocker generation system to avoid direct duplication?
    No

46. Are you comfortable with community puzzle sharing (which could replicate copyrighted sets if they exist)?
    Yes

47. What name/branding boundaries do you want to enforce (e.g., not referencing the original game anywhere)?
    Do NOT reference "Genius Square" anywhere. This is "Blocker Rush".

## Data model, telemetry, and “debuggability”

48. What do you want to measure: time-to-first-move, time-to-solve, placements per solve, hint usage?
    Time to solve for the puzzle id for all game modes. Wins/losses in multiplayer mode. Streak for daily challenge.

49. Do you want a “replay” of a solve for debugging and for competitive verification?
    No. Just show the winning grid from one of the players. In Casual mode, there are hints to be able to solve it.

## Dev workflow and scope control

50. What’s your MVP “done” line: solo practice only? async races? real-time?
    The core game done. The three modes added.

51. What features are you willing to cut even if they’re cool?
    Animations
