"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { REJOIN_GRACE_MS, type MatchSettings } from "@blocker-rush/protocol";
import type { Difficulty } from "@blocker-rush/shared";
import { difficultyOptions } from "@blocker-rush/shared";
import useLocalStorage from "../../lib/useLocalStorage";
import GameHeader from "../GameHeader";
import { useMultiplayerStore } from "./MultiplayerStore";
import ThemeSelect from "../ThemeSelect";
import { formatMs } from "./multiplayerViewUtils";
import {
  getMultiplayerRatio,
  readMultiplayerStats,
} from "./multiplayerStatsStorage";

const randomPlayerSuffix = (length = 5): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet[index];
  }).join("");
};

type MultiplayerLobbyLandingProps = {
  roomCodeFromUrl?: string;
  reconnectRoomCode?: string;
  leftRoomCode?: string;
};

export default function MultiplayerLobbyLanding({
  roomCodeFromUrl = "",
  reconnectRoomCode = "",
  leftRoomCode = "",
}: MultiplayerLobbyLandingProps) {
  const {
    state,
    requestLobby,
    retryLobby,
    joinPublic,
    joinByCode,
    createPrivate,
  } = useMultiplayerStore();

  // The name other Thorstein Games use (one origin, shared localStorage),
  // else a random one.
  const defaultPlayerName = useMemo(() => {
    try {
      const shared = window.localStorage.getItem("playerName")?.trim();
      if (shared) return shared.slice(0, 24);
    } catch {
      // Storage blocked: fall through to a random name.
    }
    return `Player${randomPlayerSuffix(5)}`;
  }, []);
  const [storedName, setStoredName] = useLocalStorage<string>(
    "multiplayer-player-name",
    defaultPlayerName,
    { raw: true },
  );
  const name = storedName ?? defaultPlayerName;
  const [roomCodeInput, setRoomCodeInput] = useState(roomCodeFromUrl);
  const [roomCodeByPrivateRoom, setRoomCodeByPrivateRoom] = useState<
    Record<string, string>
  >({});
  const [createRounds, setCreateRounds] = useState(1);
  const [createDifficulties, setCreateDifficulties] =
    useState<Difficulty[]>(difficultyOptions);
  const [renderNow, setRenderNow] = useState(() => Date.now());
  const [stats] = useState(() => readMultiplayerStats());
  const autoJoinAttemptedRoomRef = useRef("");

  useEffect(() => {
    requestLobby();
  }, [requestLobby]);

  useEffect(() => {
    if (!roomCodeFromUrl) return;
    setRoomCodeInput(roomCodeFromUrl);
  }, [roomCodeFromUrl]);

  useEffect(() => {
    if (!roomCodeFromUrl) return;
    if (!state.connected || state.roomCode) return;
    // Don't walk back into a room we just intentionally left or were kicked
    // from - the ?room=<code> URL param isn't cleared on leave/kick (it's
    // only ever pushed forward), so this landing page can mount with a
    // stale param pointing right back at a room that may still be live.
    if (roomCodeFromUrl === leftRoomCode) return;
    if (autoJoinAttemptedRoomRef.current === roomCodeFromUrl) return;
    autoJoinAttemptedRoomRef.current = roomCodeFromUrl;
    joinByCode(name, roomCodeFromUrl);
  }, [joinByCode, leftRoomCode, name, roomCodeFromUrl, state.connected, state.roomCode]);

  useEffect(() => {
    if (!state.lastConnectionLostAt || !reconnectRoomCode) return;
    setRenderNow(Date.now());
    const timer = window.setInterval(() => setRenderNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.lastConnectionLostAt, reconnectRoomCode]);

  const reconnectRemainingMs = state.lastConnectionLostAt
    ? Math.max(0, REJOIN_GRACE_MS - (renderNow - state.lastConnectionLostAt))
    : 0;

  const settings = useMemo<MatchSettings>(() => {
    const difficulties = createDifficulties.slice(0, createRounds);
    return {
      rounds: createRounds,
      difficulties: [...difficulties],
      advanceMode: "solo",
      lockInMs: 20_000,
    };
  }, [createDifficulties, createRounds]);

  const statsPanel = useMemo(
    () => (
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Wins</span>
          <span className="stat-value">{stats.wins}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Losses</span>
          <span className="stat-value">{stats.losses}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">W/L Ratio</span>
          <span className="stat-value">{getMultiplayerRatio(stats)}</span>
        </div>
      </div>
    ),
    [stats],
  );

  return (
    <main className="page game-page multiplayer-page">
      <GameHeader
        mode="multiplayer"
        statsTitle="Multiplayer Stats"
        statsPanel={statsPanel}
        settingsTitle="Multiplayer Settings"
        settingsPanel={
          <div className="settings-stack">
            <ThemeSelect />
          </div>
        }
      />
      <section className="multiplayer-lobby">
        {state.lobbyOffline ? (
          <div className="notice error lobby-status" role="alert">
            <span>
              Can&apos;t reach the game server. Check your connection, then
              try again.
            </span>
            <button className="button secondary" type="button" onClick={retryLobby}>
              Retry
            </button>
          </div>
        ) : !state.connected ? (
          <p className="lobby-status pieces-hint" role="status">
            Connecting to the game server…
          </p>
        ) : null}
        {state.error && !state.roomCode && (
          <div className="notice error lobby-status" role="alert">
            {state.error}
          </div>
        )}
        <div className="panel stack">
          <h2>Quick Join</h2>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            autoComplete="nickname"
            value={name}
            onChange={(event) => {
              setStoredName(event.target.value);
              try {
                window.localStorage.setItem("playerName", event.target.value);
              } catch {
                // Not shared with other games this time.
              }
            }}
            placeholder="Display name"
            maxLength={24}
          />
          <button
            className="button"
            type="button"
            onClick={() => joinPublic(name)}
            disabled={state.lobbyOffline}
          >
            Join Public Matchmaking
          </button>
          {reconnectRoomCode && reconnectRemainingMs > 0 && (
            <button
              className="button secondary"
              type="button"
              onClick={() => joinByCode(name, reconnectRoomCode)}
              disabled={!state.connected}
            >
              Rejoin {reconnectRoomCode} ({formatMs(reconnectRemainingMs)})
            </button>
          )}
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
              disabled={!roomCodeInput || state.lobbyOffline}
            >
              Join by Code
            </button>
          </div>
        </div>

        <div className="panel stack">
          <h2>Create Private Room</h2>
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
            disabled={state.lobbyOffline}
          >
            Create Private Room
          </button>
        </div>

        <div className="panel stack">
          <h2>Rooms</h2>
          <button
            className="button secondary"
            type="button"
            onClick={requestLobby}
            disabled={!state.connected}
          >
            Refresh
          </button>
          <div className="multiplayer-room-list">
            {!state.connected ? (
              <span className="pieces-hint">
                Open rooms show here once you&apos;re connected.
              </span>
            ) : state.lobbyRooms.length === 0 ? (
              <span className="pieces-hint">
                No open rooms right now. Join matchmaking or create one.
              </span>
            ) : (
              state.lobbyRooms.map((room) => (
                <div className="multiplayer-lobby room-row" key={room.roomCode}>
                  <div>
                    <strong>
                      {room.visibility === "private"
                        ? "Private Room"
                        : room.roomCode}
                    </strong>
                    <span className="pieces-hint">
                      {" "}
                      · {room.hostName} · {room.playerCount}/{room.maxPlayers} ·{" "}
                      {room.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="settings-actions code">
                    {room.visibility === "private" &&
                      room.status === "lobby" && (
                        <div className="stack private-room-code">
                          <label htmlFor={`private-code-${room.roomCode}`}>
                            Code for {room.hostName}’s room
                          </label>
                          <input
                            id={`private-code-${room.roomCode}`}
                            value={roomCodeByPrivateRoom[room.roomCode] ?? ""}
                            onChange={(event) =>
                              setRoomCodeByPrivateRoom((prev) => ({
                                ...prev,
                                [room.roomCode]:
                                  event.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="AB12CD"
                          />
                        </div>
                      )}
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        joinByCode(
                          name,
                          room.visibility === "private"
                            ? (roomCodeByPrivateRoom[room.roomCode] ?? "")
                            : room.roomCode,
                        )
                      }
                      disabled={
                        room.status !== "lobby" ||
                        (room.visibility === "private" &&
                          !(roomCodeByPrivateRoom[room.roomCode] ?? "").trim())
                      }
                    >
                      {room.status === "lobby" ? "Join" : "In Progress"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
