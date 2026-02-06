import CasualGame from "../../components/CasualGame";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Casual Practice",
  description:
    "Play unlimited practice boards in Blocker Rush. Pick a difficulty and train your solve speed.",
  path: "/casual",
});

export default function CasualPage() {
  return <CasualGame />;
}
