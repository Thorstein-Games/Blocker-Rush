import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>Blocker Rush</h1>
          <p>
            Race yourself through fresh 6x6 grids. Drop the blockers, spin the
            pieces, and snap the last tile into place for that next-run rush.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/casual">
              Play Casual
            </Link>
            <button className="button secondary" type="button" disabled>
              Daily Challenge (Soon)
            </button>
          </div>
        </div>
        <div className="hero-card">
          <h3>Tonight's Vibe</h3>
          <p>
            Smooth, encouraging solo runs. Every puzzle is solvable, every win
            feels earned. Multiplayer and daily streaks are coming next.
          </p>
        </div>
      </section>

      <section className="mode-grid">
        <div className="mode-card">
          <h3>Casual</h3>
          <p>
            Choose your difficulty, take as many hints as you want, and stay in
            control of the pace.
          </p>
          <Link className="button" href="/casual">
            Start a Run
          </Link>
        </div>
        <div className="mode-card">
          <h3>Multiplayer</h3>
          <p>
            Three-round sprint. Everyone gets the same puzzle, first to solve
            three wins. Countdown starts soon.
          </p>
          <button className="button secondary" type="button" disabled>
            Coming Soon
          </button>
        </div>
        <div className="mode-card">
          <h3>Daily</h3>
          <p>
            One puzzle per day, difficulty ramps up as the week heats up. Keep
            the streak alive.
          </p>
          <button className="button secondary" type="button" disabled>
            Coming Soon
          </button>
        </div>
      </section>
    </main>
  );
}
