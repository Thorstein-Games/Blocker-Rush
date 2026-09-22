"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MultiplayerLobbyLanding from "./MultiplayerLobbyLanding";
import MultiplayerRoomShell from "./MultiplayerRoomShell";
import {
  MultiplayerStoreProvider,
  useMultiplayerStore,
} from "./MultiplayerStore";

function MultiplayerGameContent() {
  const { state } = useMultiplayerStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room")?.toUpperCase() ?? "";
  const roomFromUrl = useMemo(() => roomParam.trim(), [roomParam]);

  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams.toString());
    const currentRoom = currentParams.get("room")?.toUpperCase() ?? "";

    if (!state.roomCode || currentRoom === state.roomCode) return;
    currentParams.set("room", state.roomCode);
    const query = currentParams.toString();
    router.push(`/multiplayer${query ? `?${query}` : ""}`);
  }, [router, searchParams, state.roomCode]);

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
