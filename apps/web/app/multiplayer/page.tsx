import "./multiplayer.css";
import { Suspense } from "react";
import MultiplayerGame from "../../components/multiplayer/MultiplayerGame";
import SeoContent from "../../components/SeoContent";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Multiplayer Puzzle Race – Play Online with Friends",
  description:
    "Race friends or other players on the same Blocker Rush board in real time. Join public matchmaking or create a private room with custom rounds and difficulty. Free, no account needed.",
  path: "/multiplayer",
});

export default function MultiplayerPage() {
  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <MultiplayerGame />
      </Suspense>
      <SeoContent
        heading="Race other players in Blocker Rush multiplayer"
        jsonLd={[breadcrumbJsonLd("Multiplayer", "/multiplayer")]}
      >
        <p>
          In multiplayer, everyone in the room gets the same 6×6 board with the
          same seven blockers. The first player to fit all nine pieces wins the
          round. You can watch your opponents&apos; progress as you play.
        </p>
        <h3>Ways to play</h3>
        <ul>
          <li>
            <strong>Public matchmaking</strong>: join an open room and play
            right away.
          </li>
          <li>
            <strong>Private rooms</strong>: create a room, pick the number of
            rounds and a difficulty for each one, and share the room code with
            friends.
          </li>
        </ul>
        <p>
          No sign-up or download is needed. Enter a name and start playing on
          your phone or computer.
        </p>
      </SeoContent>
    </>
  );
}
