"use client";

import { useEffect, useMemo, useState } from "react";
import type { Difficulty } from "@blocker-rush/shared";
import { difficultyOptions } from "@blocker-rush/shared";
import { useMultiplayerStore } from "./MultiplayerStore";

export default function MultiplayerRoomLobby() {
  const { state, setReady, startMatch, kickPlayer, updateSettings } =
    useMultiplayerStore();

  const players = useMemo(() => Object.values(state.players), [state.players]);
  const selfPlayer = state.selfPlayerId
    ? state.players[state.selfPlayerId]
    : undefined;
  const selfIsHost = state.hostId === state.selfPlayerId;

  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [hostRounds, setHostRounds] = useState(state.settings.rounds);
  const [hostDifficulties, setHostDifficulties] = useState<Difficulty[]>(
    state.settings.difficulties,
  );

  useEffect(() => {
    setHostRounds(state.settings.rounds);
    setHostDifficulties(state.settings.difficulties);
  }, [state.settings.difficulties, state.settings.rounds]);

  const handleShareRoom = async () => {
    if (!state.roomCode) return;
    const url = `${window.location.origin}/multiplayer?room=${state.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: url, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus("Room link copied.");
    } catch {
      setShareStatus("Unable to share right now.");
    }
  };

  const handleCopyRoomCode = async () => {
    if (!state.roomCode) return;
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(state.roomCode);
      setShareStatus("Room code copied.");
    } catch {
      setShareStatus("Unable to copy room code.");
    }
  };

  const applyHostSettings = (
    nextRounds: number,
    nextDifficulties: Difficulty[],
  ) => {
    const difficulties = nextDifficulties.slice(0, nextRounds);
    updateSettings({
      rounds: nextRounds,
      difficulties,
      advanceMode: state.settings.advanceMode,
      lockInMs: state.settings.lockInMs,
    });
  };

  return (
    <section className="multiplayer-room-stage panel stack">
      <h3>
        Room{" "}
        <button
          className="room-code-button"
          type="button"
          onClick={handleCopyRoomCode}
          disabled={!state.roomCode}
          title="Copy room code"
        >
          {state.roomCode}
        </button>
      </h3>
      <div className="multiplayer-room-list">
        {players.map((player) => (
          <div className="room-row" key={player.playerId}>
            <div>
              <strong>{player.name} · </strong>
              <span className="pieces-hint">
                {player.connected ? "Connected" : "Disconnected"} ·{" "}
                {player.ready ? "Ready" : "Not ready"}
              </span>
            </div>
            {selfIsHost && player.playerId !== state.selfPlayerId && (
              <button
                className="button secondary"
                type="button"
                onClick={() => kickPlayer(player.playerId)}
              >
                Kick
              </button>
            )}
          </div>
        ))}
      </div>
      {selfIsHost && state.status === "lobby" && (
        <div className="panel stack">
          <h4>Room Settings</h4>
          <label htmlFor="host-rounds">Rounds</label>
          <select
            id="host-rounds"
            value={hostRounds}
            onChange={(event) => {
              const nextRounds = Number(event.target.value);
              setHostRounds(nextRounds);
              applyHostSettings(nextRounds, hostDifficulties);
            }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          {Array.from({ length: hostRounds }, (_, index) => (
            <div className="stack" key={`host-difficulty-${index}`}>
              <label htmlFor={`host-difficulty-${index}`}>
                Round {index + 1} difficulty
              </label>
              <select
                id={`host-difficulty-${index}`}
                value={
                  hostDifficulties[index] ?? difficultyOptions[index] ?? "easy"
                }
                onChange={(event) => {
                  const nextDifficulties = [...hostDifficulties];
                  nextDifficulties[index] = event.target.value as Difficulty;
                  setHostDifficulties(nextDifficulties);
                  applyHostSettings(hostRounds, nextDifficulties);
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
        </div>
      )}
      <div className="settings-actions">
        <button
          className="button secondary"
          type="button"
          onClick={handleShareRoom}
        >
          Share Room Link
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => setReady(!(selfPlayer?.ready ?? false))}
        >
          {selfPlayer?.ready ? "Unready" : "Ready"}
        </button>
        {selfIsHost && (
          <button
            className="button"
            type="button"
            onClick={startMatch}
            disabled={players.length < 2}
          >
            Start Match
          </button>
        )}
      </div>
      {shareStatus && <div className="notice">{shareStatus}</div>}
    </section>
  );
}
