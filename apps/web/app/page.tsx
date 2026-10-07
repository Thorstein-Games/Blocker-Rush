import DailyGame from "../components/DailyGame";
import SeoContent from "../components/SeoContent";
import { type Faq, buildPageMetadata, videoGameJsonLd } from "../lib/seo";

export const metadata = buildPageMetadata({
  title: "Blocker Rush – Free Daily Block Puzzle Like Genius Square",
  absoluteTitle: true,
  description:
    "Solve today's free Blocker Rush puzzle: fit 9 pieces around 7 blockers on a 6×6 board. A new daily logic puzzle every day, inspired by The Genius Square. Build your streak and share your result.",
  path: "/",
});

const faqs: Faq[] = [
  {
    question: "What is Blocker Rush?",
    answer:
      "Blocker Rush is a free online block-placement puzzle. Seven squares of a 6×6 board are blocked, and you have to fit all nine pieces into the remaining 29 squares. It plays like the board game The Genius Square, right in your browser.",
  },
  {
    question: "How often is there a new daily puzzle?",
    answer:
      "A new daily puzzle unlocks every day at local midnight. Everyone gets the same board, so you can compare results with friends and keep your streak going.",
  },
  {
    question: "How hard is the daily puzzle?",
    answer:
      "Difficulty follows the week: Sunday and Monday are easy, Tuesday and Wednesday are medium, Thursday and Friday are hard, and Saturday is insane. Difficulty is measured by how many solutions a board has. Insane boards have only one to three.",
  },
  {
    question: "Does every Blocker Rush puzzle have a solution?",
    answer:
      "Yes. Every board comes from a dataset that was checked with a solver, so each puzzle has at least one way to place all nine pieces.",
  },
  {
    question: "Is Blocker Rush free? Do I need an account?",
    answer:
      "It is completely free and needs no account or download. It works on phones, tablets and desktop browsers, with touch, mouse and keyboard controls.",
  },
];

export default function HomePage() {
  return (
    <>
      <DailyGame />
      <SeoContent
        heading="Play the Blocker Rush daily puzzle"
        faqs={faqs}
        jsonLd={[videoGameJsonLd]}
      >
        <p>
          Blocker Rush is a quick daily logic puzzle you can play free in your
          browser. Each board is a 6×6 grid with seven blocked squares. Your goal
          is to fill every other square using all nine pieces, with no gaps and
          no overlaps. If you have played The Genius Square, you already know
          the idea. Here you get a fresh board every day and a streak to keep alive.
        </p>
        <h3>How to play</h3>
        <ol>
          <li>Pick a piece from the tray, then tap or drag it onto the board.</li>
          <li>Rotate and flip pieces to make them fit around the blockers.</li>
          <li>
            Double-tap a placed piece to take it back, or use Undo and Clear.
          </li>
          <li>Place all nine pieces to solve the puzzle.</li>
        </ol>
        <p>
          Want more after today&apos;s board? Practice with unlimited puzzles in
          casual mode, or race other players in real time in multiplayer.
        </p>
      </SeoContent>
    </>
  );
}
