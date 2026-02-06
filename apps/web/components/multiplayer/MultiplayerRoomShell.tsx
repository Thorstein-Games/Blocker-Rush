"use client";

import GameHeader from "../GameHeader";
import ThemeSelect from "../ThemeSelect";
import MultiplayerActiveMatch from "./MultiplayerActiveMatch";
import MultiplayerResultModal from "./MultiplayerResultModal";
import MultiplayerRoomLobby from "./MultiplayerRoomLobby";
import { useMultiplayerStore } from "./MultiplayerStore";

export default function MultiplayerRoomShell() {
  const { state, requestSync, leaveRoom } = useMultiplayerStore();

  const isInActiveGame =
    state.status === "countdown" ||
    state.status === "in_game" ||
    state.status === "finished";

  return (
    <>
      <main className="page game-page multiplayer-page">
        <GameHeader
          mode="multiplayer"
          settingsTitle="Multiplayer Settings"
          settingsPanel={
            <div className="settings-stack">
              <ThemeSelect />
              <button
                className="button secondary"
                type="button"
                onClick={requestSync}
              >
                Request Sync
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={leaveRoom}
              >
                Return to Lobby
              </button>
            </div>
          }
        />

        {state.status === "lobby" && <MultiplayerRoomLobby />}
        {isInActiveGame && <MultiplayerActiveMatch />}
      </main>

      <MultiplayerResultModal />
    </>
  );
}
