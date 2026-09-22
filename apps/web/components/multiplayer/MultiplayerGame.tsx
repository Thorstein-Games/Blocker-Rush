"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import MultiplayerLobbyLanding from "./MultiplayerLobbyLanding";
import MultiplayerRoomShell from "./MultiplayerRoomShell";
import {
  MultiplayerStoreProvider,
  useMultiplayerStore,
} from "./MultiplayerStore";

function MultiplayerGameContent() {
  const { state } = useMultiplayerStore();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room")?.toUpperCase() ?? "";
  const roomFromUrl = useMemo(() => roomParam.trim(), [roomParam]);

  // Keep ?room=<code> in sync with the joined room so a reload can rejoin
  // via roomCodeFromUrl. This must land synchronously with the state update
  // that makes the room code visible in the UI - router.push() is an async
  // client-side transition, and a reload() fired in that window (e.g. a
  // test asserting on the visible room code, or a user hitting refresh
  // right after joining) would land back on a bare /multiplayer with
  // nothing to auto-rejoin. history.replaceState is synchronous.
  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    const currentRoom = currentParams.get("room")?.toUpperCase() ?? "";

    if (!state.roomCode || currentRoom === state.roomCode) return;
    currentParams.set("room", state.roomCode);
    const query = currentParams.toString();
    window.history.replaceState(null, "", `/multiplayer${query ? `?${query}` : ""}`);
  }, [state.roomCode]);

  if (!state.roomCode) {
    return (
      <MultiplayerLobbyLanding
        roomCodeFromUrl={roomFromUrl}
        reconnectRoomCode={state.reconnectRoomCode}
        leftRoomCode={state.leftRoomCode}
      />
    );
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
