import DailyGame from "../components/DailyGame";
import { buildPageMetadata } from "../lib/seo";

export const metadata = buildPageMetadata({
  title: "Daily Challenge",
  description:
    "Solve today’s Blocker Rush puzzle, track your streak, and share your result.",
  path: "/",
});

export default function HomePage() {
  return <DailyGame />;
}
