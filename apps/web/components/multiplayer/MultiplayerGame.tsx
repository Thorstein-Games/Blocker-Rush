"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchSettings, PiecePlacement } from "@blocker-rush/protocol";
import type { Difficulty } from "@blocker-rush/shared";
import {
  PIECE_TRANSFORMS,
  getPuzzleById,
  parsePuzzleId,
  placePiece,
  withBlockers,
} from "@blocker-rush/shared";
import GameHeader from "../GameHeader";
import MultiplayerBoardPanel from "./MultiplayerBoardPanel";
import { useMultiplayerStore } from "./MultiplayerStore";
import type { TrackedPlayer } from "./useMultiplayerSocket";

const formatMs = (ms: number): string => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const resolveBlockers = (puzzleId: string) => {
  const puzzle = getPuzzleById(puzzleId);
  if (puzzle) return puzzle.blockers;
  try {
    return parsePuzzleId(puzzleId);
  } catch {
    return [];
  }
};

const buildMiniCells = (pieces: PiecePlacement[], puzzleId: string): Array<string | null> => {
  const blockers = resolveBlockers(puzzleId);
  let board = withBlockers(blockers);

  for (const piece of pieces) {
    const transform = PIECE_TRANSFORMS[piece.pieceId]?.find(
      (item) => item.id === piece.transformId,
    );
    if (!transform) continue;
    board = placePiece(board, piece.pieceId, transform, { x: piece.x, y: piece.y });
  }

  return board.cells.map((cell) => (cell === null ? null : String(cell)));
};

const difficultySequence = ["easy", "medium", "hard"] as const;
const difficultyOptions: Difficulty[] = ["easy", "medium", "hard", "insane"];

export default function MultiplayerGame() {
  const {
    state,
    requestLobby,
    joinPublic,
    joinByCode,
    createPrivate,
    leaveRoom,
    setReady,
    startMatch,
    requestSync,
    sendPlace,
    sendRemove,
    sendUndo,
    submitFinish,
  } = useMultiplayerStore();

  const [name, setName] = useState("Player");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [createRounds, setCreateRounds] = useState(1);
  const [createDifficulties, setCreateDifficulties] = useState<Difficulty[]>([
    "easy",
    "medium",
    "hard",
  ]);
  const [renderNow, setRenderNow] = useState(() => Date.now());
  const [publicWaitStartedAt, setPublicWaitStartedAt] = useState<number | null>(
    null,
  );

  useEffect(() => {
    requestLobby();
  }, [requestLobby]);

  useEffect(() => {
    const timer = window.setInterval(() => setRenderNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const settings = useMemo<MatchSettings>(() => {
    const difficulties = createDifficulties.slice(0, createRounds);
    return {
      rounds: createRounds,
      difficulties: [...difficulties],
      advanceMode: "solo",
      lockInMs: 20_000,
    };
  }, [createDifficulties, createRounds]);

  const players = Object.values(state.players);
  const selfPlayer = state.selfPlayerId ? state.players[state.selfPlayerId] : undefined;
  const opponents = players.filter((player) => player.playerId !== state.selfPlayerId);
  const adjustedNow = renderNow + state.clockOffsetMs;

  const countdownMs =
    state.status === "countdown" && state.match
      ? Math.max(0, state.match.startTime - adjustedNow)
      : 0;

  const winnerWindowMs =
    state.status === "winner_window"
      ? Math.max(
          0,
          (state.winner?.lockEndsAt ?? state.match?.lockEndsAt ?? adjustedNow) -
            adjustedNow,
        )
      : 0;

  const authoritativeReject =
    state.lastRejected?.authoritativeState && selfPlayer
      ? {
          roundIndex: state.lastRejected.authoritativeState.roundIndex,
          placedPieces: state.lastRejected.authoritativeState.placedPieces,
        }
      : undefined;

  const isInRoom = Boolean(state.roomCode);
  const isInActiveGame =
    state.status === "countdown" ||
    state.status === "in_game" ||
    state.status === "winner_window" ||
    state.status === "finished";

  const selfIsHost = state.hostId === state.selfPlayerId;
  const isPublicWaitRoom =
    state.status === "lobby" &&
    state.roomVisibility === "public" &&
    players.length <= 1;

  useEffect(() => {
    if (isPublicWaitRoom) {
      setPublicWaitStartedAt((prev) => prev ?? Date.now());
      return;
    }
    setPublicWaitStartedAt(null);
  }, [isPublicWaitRoom]);

  const publicWaitRemainingMs = publicWaitStartedAt
    ? Math.max(0, 30_000 - (renderNow - publicWaitStartedAt))
    : 0;

  if (!isInRoom) {
    return (
      <main className="page game-page multiplayer-page">
        <GameHeader mode="multiplayer" />
        <section className="multiplayer-lobby">
          <div className="panel stack">
            <h3>Quick Join</h3>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Display name"
              maxLength={24}
            />
            <button className="button" type="button" onClick={() => joinPublic(name)}>
              Join Public Matchmaking
            </button>
            <div className="stack">
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
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
                <label htmlFor={`difficulty-${index}`}>Round {index + 1} difficulty</label>
                <select
                  id={`difficulty-${index}`}
                  value={createDifficulties[index] ?? difficultySequence[index] ?? "easy"}
                  onChange={(event) => {
                    const next = [...createDifficulties];
                    next[index] = event.target.value as Difficulty;
                    setCreateDifficulties(next);
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
            <button className="button" type="button" onClick={() => createPrivate(name, settings)}>
              Create Private Room
            </button>
          </div>

          <div className="panel stack">
            <h3>Open Public Rooms</h3>
            <button className="button secondary" type="button" onClick={requestLobby}>
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

  return (
    <main className="page game-page multiplayer-page">
      <GameHeader
        mode="multiplayer"
        statsTitle="Room"
        statsPanel={
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Room</span>
              <span className="stat-value">{state.roomCode}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Status</span>
              <span className="stat-value">{state.status}</span>
            </div>
          </div>
        }
        settingsTitle="Multiplayer"
        settingsPanel={
          <div className="settings-stack">
            <button className="button secondary" type="button" onClick={requestSync}>
              Request Sync
            </button>
            <button className="button secondary" type="button" onClick={leaveRoom}>
              Return to Lobby
            </button>
          </div>
        }
      />

      {state.status === "lobby" && (
        <section className="multiplayer-room-stage panel stack">
          <h3>Room {state.roomCode}</h3>
          {isPublicWaitRoom && (
            <div className="notice">
              Matchmaking wait: {formatMs(publicWaitRemainingMs)} remaining.
              {publicWaitRemainingMs === 0 &&
                " No opponent found yet. Keep waiting or return to lobby."}
            </div>
          )}
          <div className="multiplayer-room-list">
            {players.map((player) => (
              <div className="room-row" key={player.playerId}>
                <div>
                  <strong>{player.name}</strong>
                  <span className="pieces-hint">
                    {player.connected ? "Connected" : "Disconnected"} · {player.ready ? "Ready" : "Not ready"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-actions">
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
        </section>
      )}

      {isInActiveGame && (
        <section className="multiplayer-game-layout">
          <aside className="opponents-column">
            <h3>Opponents</h3>
            {opponents.length === 0 ? (
              <span className="pieces-hint">Waiting for players…</span>
            ) : (
              opponents.map((player) => (
                <OpponentCard key={player.playerId} player={player} />
              ))
            )}
          </aside>

          <div className="game-center multiplayer-main-board">
            {state.status === "countdown" && (
              <div className="notice">Round starts in {formatMs(countdownMs)}</div>
            )}

            {state.status === "winner_window" && (
              <div className="notice">
                Winner decided. Finalizing in {formatMs(winnerWindowMs)}
              </div>
            )}

            {state.error && <div className="notice">{state.error}</div>}

            <MultiplayerBoardPanel
              selfPlayer={selfPlayer}
              active={state.status === "in_game" || state.status === "winner_window"}
              onPlace={sendPlace}
              onRemove={sendRemove}
              onUndo={sendUndo}
              onSubmitFinish={submitFinish}
              authoritativeReject={authoritativeReject}
            />
          </div>
        </section>
      )}

      {state.status === "finished" && state.result && (
        <section className="panel stack multiplayer-result">
          <h3>Match Result</h3>
          <p>
            Winner: <strong>{state.result.winnerId}</strong>
          </p>
          <div className="multiplayer-room-list">
            {state.result.placements.map((placement) => (
              <div className="room-row" key={placement.playerId}>
                <div>
                  <strong>
                    #{placement.place} {state.players[placement.playerId]?.name ?? placement.playerId}
                  </strong>
                  <span className="pieces-hint">
                    {placement.status} · rounds {placement.roundsCompleted}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-actions">
            {selfIsHost && (
              <button className="button" type="button" onClick={startMatch}>
                Play Again with Same Group
              </button>
            )}
            <button className="button secondary" type="button" onClick={leaveRoom}>
              Return to Lobby
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function OpponentCard({ player }: { player: TrackedPlayer }) {
  const cells = useMemo(
    () =>
      player.round?.puzzleId
        ? buildMiniCells(player.round.placedPieces, player.round.puzzleId)
        : Array.from({ length: 36 }, () => null),
    [player.round?.placedPieces, player.round?.puzzleId],
  );

  return (
    <article className="opponent-card">
      <header>
        <strong>{player.name}</strong>
        <span className="pieces-hint">Round {player.currentRoundIndex + 1}</span>
      </header>
      <div className="opponent-mini-board">
        {cells.map((cell, index) => (
          <div
            key={index}
            className={[
              "opponent-mini-cell",
              cell === "blocker" ? "blocker" : null,
              cell && cell !== "blocker" ? "piece" : null,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
      <div className="pieces-hint">Splits: {player.splitsMs.map((split) => (split ? formatMs(split) : "--")).join(" · ")}</div>
    </article>
  );
}
