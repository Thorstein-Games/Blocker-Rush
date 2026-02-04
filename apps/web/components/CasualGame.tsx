"use client";

import type { Difficulty } from "@blocker-rush/shared";
import GameBoard from "./GameBoard";
import PiecesTray from "./PiecesTray";
import { GameProvider, difficultyOptions, useGame } from "./GameContext";

function CasualGameLayout() {
  const {
    difficulty,
    setDifficulty,
    puzzleInput,
    setPuzzleInput,
    puzzleDifficulty,
    currentStats,
    hint,
    shareStatus,
    solved,
    loadPuzzleFromInput,
    loadRandomPuzzle,
    handleHint,
    handleShare,
  } = useGame();

  return (
    <main className="page">
      <section className="casual-layout">
        <div className="panel">
          <h2>Casual Run</h2>
          <div className="stack">
            <label htmlFor="difficulty">Difficulty</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              {difficultyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="stack">
            <label htmlFor="puzzle-input">Puzzle ID</label>
            <input
              id="puzzle-input"
              value={puzzleInput}
              onChange={(event) => setPuzzleInput(event.target.value)}
              placeholder="A1A2B4B6C5D5F1"
            />
            <div className="status-row">
              <button
                className="button"
                type="button"
                onClick={loadPuzzleFromInput}
              >
                Load Puzzle
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={loadRandomPuzzle}
              >
                New Random
              </button>
            </div>
          </div>
          <div className="status-row">
            {puzzleDifficulty && (
              <span className="badge">{puzzleDifficulty}</span>
            )}
            {currentStats && (
              <span>
                Moves: {currentStats.moves} · Best:{" "}
                {currentStats.bestMoves ?? "--"}
              </span>
            )}
          </div>
          <div className="status-row">
            <button
              className="button secondary"
              type="button"
              onClick={handleHint}
            >
              Hint
            </button>
            <button className="button secondary" type="button" disabled>
              Watch Ad for Hint
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={handleShare}
              disabled={!solved}
            >
              Share
            </button>
          </div>
          {hint && <div className="notice">{hint}</div>}
          {shareStatus && <div className="notice">{shareStatus}</div>}
          <div className="ad-slot">Ad slot placeholder</div>
        </div>

        <div className="game-center">
          <GameBoard />
          <PiecesTray />
        </div>
      </section>
    </main>
  );
}

export default function CasualGame() {
  return (
    <GameProvider>
      <CasualGameLayout />
    </GameProvider>
  );
}
