import DailyGame from "../components/DailyGame";
import { buildPageMetadata } from "../lib/seo";

export const metadata = buildPageMetadata({
  title: "Blocker Rush | Daily Challenge | Play Genius Square Online",
  description:
    "Solve today's Blocker Rush puzzle, track your streak, and share your result.",
  path: "/",
});

export default function HomePage() {
  return <DailyGame />;
}
