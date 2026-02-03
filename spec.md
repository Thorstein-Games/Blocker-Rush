# Interview (non-obvious, detailed)

## Product intent, “feel,” and what makes it not a clone

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

7. Do you want “daily puzzle” stability? If yes: should it be global or per-region, and should it respect local midnight?

8. Are you okay with rotating puzzle sets over time (to keep things fresh), or must your puzzle IDs remain permanent?

9. If two players race, do they always get the same puzzle? If yes, how do you handle latency so it still feels fair?

## Blockers generation model (dice, randomness, and difficulty)

10. Do you want to replicate physical dice exactly (same faces/odds), or do you want “dice-like” randomness optimized for gameplay?

11. Should blockers ever create “tight but solvable” boards where only 1–2 solutions exist, or should multiple solutions be common?

12. Would you rather guarantee “solvable” by precomputing puzzles, or allow true randomness and solve-check on the fly?

13. Do you want difficulty levels to be: based on solver complexity (search depth), based on human friction (how many dead-ends), based on time-to-solve targets, or a mix?

14. Do you want “leveling” to be strictly 5 levels like the product, or “infinite ladder” with leagues?

## Piece placement rules and interaction design

14. Should pieces be rotatable only in 90° increments? Are reflections allowed for any pieces?

15. Do you want to allow “hover ghost placement” + auto-snapping, or require precise drag?

16. How strict is the board: can pieces be placed partially outside then rejected, or should placement be impossible outside valid squares?

17. Do you want “tap to cycle rotations” on mobile, or a dedicated rotate UI?

18. What should happen if the player tries to place a piece in an invalid spot: block it completely, allow it but show red overlay, or allow and only validate on “submit”?

## Hints, verification, and the psychology of help

19. When should validation occur: real-time, on-demand, or only when complete?

20. Should hints be “directional” (e.g., “this piece doesn’t belong there”) or “constructive” (e.g., “try placing piece L in top-left”)?

21. Do you want a “training wheels” mode that shows all legal placements as you hover? (It’s powerful but can trivialize.)

22. If a player is stuck, do you want a mechanic like: limited undos, limited peeks, a time penalty for hints, or a rank penalty?

23. How do you want to treat near-misses: celebrate progress, or keep it clinical?

## Competitive mode (fairness is mostly invisible design)

24. In 2-player, what is “winning”: first to finish current puzzle, or first to clear a set, or best-of-N?

25. If one player finishes much faster, do they: instantly start next level while other continues, or does the round end and both advance?

26. How do you prevent “waiting grief”: player finishes and then just stalls to manipulate matchmaking/levels?

27. Do you want synchronous real-time multiplayer, or asynchronous races (ghost times / leaderboards)?

28. For real-time multiplayer: are you comfortable with “server-authoritative state,” or would you accept client-authoritative with anti-cheat heuristics?

## Anti-cheat and trust model (even casual games need a plan)

29. What do you consider cheating: using solver tools, modified clients, packet replay, or simply “copying a friend’s solution”?

30. Do you want to hide puzzle definitions client-side to prevent trivial solvers, or accept that users can always reverse-engineer?

31. Would you rather protect: leaderboards, matchmaking integrity, or puzzle IP / scarcity?

32. Do you want to detect impossible completion times and flag them automatically?

## Performance constraints (where the game will actually break)

33. Do you want instant responsiveness on low-end phones? What’s your minimum target device/browser?

34. Should the game work offline (PWA) with local puzzle cache?

35. Will you animate piece snapping / celebratory effects? (Animations can conflict with precision interaction.)

36. Are you okay with heavier computation (solvers) on the client, or must everything remain smooth at 60fps?

## Accessibility and inclusivity (beyond “add ARIA”)

37. Are you designing for colorblind users—what’s your plan for conveying collision/invalid placement without relying on red/green?

38. Keyboard-only: do you want a fully playable mode using arrow keys + rotate + place?

39. Screen reader: do you want a simplified “text-mode board,” or is “screen reader support for menus only” acceptable?

40. Motion sensitivity: do you need a reduced motion mode for animations?

## Economy, progression, retention (even if free)

41. Is the goal “viral and free,” “subscription puzzle club,” “one-time purchase,” or “sponsored competition”?

42. If you add cosmetics (themes, pieces skins), should they impact clarity (dangerous) or stay purely decorative?

43. Do you want skill-based rating (Elo-like) or simple streak progression?

44. Will you store personal stats? If yes, what’s the player-facing promise about privacy?

## Legal/branding/IP risk (important given the inspiration)

45. Are you aiming for “inspired by” with original pieces/art/rules, or a faithful digital version?

46. Will you create your own piece set and blocker generation system to avoid direct duplication?

47. Are you comfortable with community puzzle sharing (which could replicate copyrighted sets if they exist)?

48. What name/branding boundaries do you want to enforce (e.g., not referencing the original game anywhere)?

## Data model, telemetry, and “debuggability”

49. What do you want to measure: time-to-first-move, time-to-solve, placements per solve, hint usage, rage quits?

50. Do you want a “replay” of a solve for debugging and for competitive verification?

51. Do you want the ability to reproduce a bug from a single “share trace” string?

## Operations, moderation, and abuse

52. If you have usernames/chat/emotes: what moderation level do you want?

53. Do you need “report player,” “block user,” or “private matches only”?

54. How do you want to handle toxic behavior like stalling, spam rematches, or smurfing?

## Dev workflow and scope control

55. What’s your MVP “done” line: solo practice only? async races? real-time?

56. What features are you willing to cut even if they’re cool?

57. Do you want puzzle generation/validation to be deterministic across platforms (important for fairness)?

58. How comfortable are you with writing a solver (exact cover / DLX style) vs using a simpler backtracking approach?
