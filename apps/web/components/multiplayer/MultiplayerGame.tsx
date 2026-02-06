"use client";

import MultiplayerLobbyLanding from "./MultiplayerLobbyLanding";
import MultiplayerRoomShell from "./MultiplayerRoomShell";
import {
  MultiplayerStoreProvider,
  useMultiplayerStore,
} from "./MultiplayerStore";

function MultiplayerGameContent() {
  const { state } = useMultiplayerStore();

  if (!state.roomCode) {
    return <MultiplayerLobbyLanding />;
  }

  return <MultiplayerRoomShell />;
}

export default function MultiplayerGame() {
  return (
    <MultiplayerStoreProvider>
      <MultiplayerGameContent />
    </MultiplayerStoreProvider>
  );
}
