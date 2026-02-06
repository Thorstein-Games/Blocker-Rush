"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchSettings } from "@blocker-rush/protocol";
import type { Difficulty } from "@blocker-rush/shared";
import { difficultyOptions } from "@blocker-rush/shared";
import useLocalStorage from "../../lib/useLocalStorage";
import GameHeader from "../GameHeader";
import { useMultiplayerStore } from "./MultiplayerStore";
import ThemeSelect from "../ThemeSelect";

const randomPlayerSuffix = (length = 5): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet[index];
  }).join("");
};

export default function MultiplayerLobbyLanding() {
  const { state, requestLobby, joinPublic, joinByCode, createPrivate } =
    useMultiplayerStore();

  const defaultPlayerName = useMemo(() => `Player${randomPlayerSuffix(5)}`, []);
  const [storedName, setStoredName] = useLocalStorage<string>(
    "multiplayer-player-name",
    defaultPlayerName,
    { raw: true },
  );
  const name = storedName ?? defaultPlayerName;
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [createRounds, setCreateRounds] = useState(1);
  const [createDifficulties, setCreateDifficulties] =
    useState<Difficulty[]>(difficultyOptions);

  useEffect(() => {
    requestLobby();
  }, [requestLobby]);

  const settings = useMemo<MatchSettings>(() => {
    const difficulties = createDifficulties.slice(0, createRounds);
    return {
      rounds: createRounds,
      difficulties: [...difficulties],
      advanceMode: "solo",
      lockInMs: 20_000,
    };
  }, [createDifficulties, createRounds]);

  return (
    <main className="page game-page multiplayer-page">
      <GameHeader
        mode="multiplayer"
        settingsTitle="Multiplayer Settings"
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="multiplayer-lobby">
        <div className="panel stack">
          <h3>Quick Join</h3>
          <input
            value={name}
            onChange={(event) => setStoredName(event.target.value)}
            placeholder="Display name"
            maxLength={24}
          />
          <button
            className="button"
            type="button"
            onClick={() => joinPublic(name)}
          >
            Join Public Matchmaking
          </button>
          <div className="stack">
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              value={roomCodeInput}
              onChange={(event) =>
                setRoomCodeInput(event.target.value.toUpperCase())
              }
              placeholder="AB12CD"
            />
            <button
              className="button secondary"
              type="button"
              onClick={() => joinByCode(name, roomCodeInput)}
              disabled={!roomCodeInput}
            >
              Join by Code
            </button>
          </div>
        </div>

        <div className="panel stack">
          <h3>Create Private Room</h3>
          <label htmlFor="rounds">Rounds</label>
          <select
            id="rounds"
            value={createRounds}
            onChange={(event) => setCreateRounds(Number(event.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          {Array.from({ length: createRounds }, (_, index) => (
            <div className="stack" key={index}>
              <label htmlFor={`difficulty-${index}`}>
                Round {index + 1} difficulty
              </label>
              <select
                id={`difficulty-${index}`}
                value={
                  createDifficulties[index] ??
                  difficultyOptions[index] ??
                  "easy"
                }
                onChange={(event) => {
                  setCreateDifficulties((prev) => {
                    const next = [...prev];
                    next[index] = event.target.value as Difficulty;
                    return next;
                  });
                }}
              >
                {difficultyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            className="button"
            type="button"
            onClick={() => createPrivate(name, settings)}
          >
            Create Private Room
          </button>
        </div>

        <div className="panel stack">
          <h3>Open Public Rooms</h3>
          <button
            className="button secondary"
            type="button"
            onClick={requestLobby}
          >
            Refresh
          </button>
          <div className="multiplayer-room-list">
            {state.lobbyRooms.length === 0 ? (
              <span className="pieces-hint">No open rooms yet.</span>
            ) : (
              state.lobbyRooms.map((room) => (
                <div className="room-row" key={room.roomCode}>
                  <div>
                    <strong>{room.roomCode}</strong>
                    <span className="pieces-hint">
                      {room.hostName} · {room.playerCount}/{room.maxPlayers}
                    </span>
                  </div>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => joinByCode(name, room.roomCode)}
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
