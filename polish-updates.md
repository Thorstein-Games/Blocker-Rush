# Polish updates checklist

## Board

- [x] Keyboard keys "d" and "right arrow" rotates piece forward while "s" and "left arrow rotates piece backward
- [x] Double click on piece on board to remove it

## Daily Challenge mode

- [x] On larger screens (not mobile), show the stats in a card to the left of the board instead of an icon at the top
- [x] When the game is over, add a share button and a "play multiplayer" button
- [x] Update the share ascii to include like square colored emojis for the blocks instead or the letter "p": 🟥, 🟧, 🟩 etc. Don't put all the placement pieces on the board, just a few as to not give away the solution.

## Causual mode

- [x] On larger screens (not mobile), show the casual settings in a card to the left of the board instead of an icon at the top
- [x] Bug: changing the puzzle ID and then clicking "Load Puzzle" does not update the board.
- [x] Even though the game is pulling from the sample dataset, allow changing the Puzzle ID to any valid id (A-F1-6, 6 times). Do an on client solver to determine it's difficulty
- [x] Remove all ad placements and watching ad for hint

## Multiplayer mode

- [x] Show the game id in the URL so that the game is part of the browser history so that the user can get back. This will also help with sharing the game id with friends.

### Multiplayer lobby

- [x] Display the list of all game rooms waiting or in progress (not just open public games). The games in progress should be disabled/read-only. Add a small input to enter the code to the right of the join button for private games waiting.
- [x] If the user was just in a game and disconnected, add a button to rejoin current game (within the 30 seconds from disconnecting)

### Room lobby

- [x] Add a share button that to send the link to the room.
- [x] Add a kick button for the host next to each other player's list item.

### In Game Multiplayer

- [x] Remove the "undo" button during the game. Undo should automatically happen when the piece is dragged off the board or double clicked
- [x] Add a card to the right of the board. Remove the card on Mobile
- [x] Move the "Round {index} · Live" to the card to the right of the board.
- [x] Remove the stats panel icon and move the info (room id and status) to the card to the right of the board. Remove on Mobile
- [x] Add a timer to the right card.
- [x] Shrink the opponents boards in half and place two per row. This is to fit more opponents on the screen real estate.
- [x] Only include the splits if there's more than 1 round.
- [x] In the results modal, shrink the winning board
