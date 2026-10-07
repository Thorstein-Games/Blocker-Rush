import "./casual.css";
import { Suspense } from "react";
import CasualGame from "../../components/CasualGame";
import SeoContent from "../../components/SeoContent";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Unlimited Practice Puzzles, Easy to Insane",
  description:
    "Play unlimited free Blocker Rush puzzles. Choose easy, medium, hard or insane boards, or load a puzzle by ID, and train your solve speed on this Genius Square–style block puzzle.",
  path: "/casual",
});

export default function CasualPage() {
  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <CasualGame />
      </Suspense>
      <SeoContent
        heading="Unlimited Blocker Rush practice puzzles"
        jsonLd={[breadcrumbJsonLd("Casual practice", "/casual")]}
      >
        <p>
          Casual mode gives you as many Blocker Rush boards as you want. Every
          puzzle uses the same rules as the daily challenge: fit all nine pieces
          into a 6×6 grid around seven blockers. There is no streak to protect,
          so it is the place to learn shapes and get faster.
        </p>
        <h3>Difficulty levels</h3>
        <ul>
          <li>
            <strong>Easy</strong>: more than 50 different solutions, so most
            starts lead somewhere.
          </li>
          <li>
            <strong>Medium</strong>: 11 to 50 solutions.
          </li>
          <li>
            <strong>Hard</strong>: 4 to 10 solutions. Plan your large pieces
            first.
          </li>
          <li>
            <strong>Insane</strong>: only 1 to 3 solutions. Every placement
            counts.
          </li>
        </ul>
        <p>
          Every board has a puzzle ID, so you can replay one or send it to a
          friend.
        </p>
      </SeoContent>
    </>
  );
}
