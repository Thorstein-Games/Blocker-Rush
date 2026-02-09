import "./multiplayer.css";
import { Suspense } from "react";
import MultiplayerGame from "../../components/multiplayer/MultiplayerGame";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Multiplayer | Blocker Rush",
  description:
    "Create or join a Blocker Rush room and race another player in real time.",
  path: "/multiplayer",
});

export default function MultiplayerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MultiplayerGame />
    </Suspense>
  );
}
