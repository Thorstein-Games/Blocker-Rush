import DailyArchive from "../../components/DailyArchive";
import SeoContent from "../../components/SeoContent";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Past Daily Puzzles – Archive",
  description:
    "Missed a day? Play every past Blocker Rush daily puzzle, from easy Sundays to insane Saturdays. Free Genius Square–style block puzzles with a solve timer.",
  path: "/daily",
});

export default function DailyArchivePage() {
  return (
    <>
      <DailyArchive />
      <SeoContent
        heading="The Blocker Rush daily puzzle archive"
        jsonLd={[breadcrumbJsonLd(["Past daily puzzles", "/daily"])]}
      >
        <p>
          Every Blocker Rush daily puzzle stays playable here after its day is
          over. Difficulty follows the week: Sunday and Monday are easy,
          Tuesday and Wednesday are medium, Thursday and Friday are hard, and
          Saturday is insane. Catch up on the days you missed. Past puzzles
          have their own timer and don&apos;t change your daily streak.
        </p>
      </SeoContent>
    </>
  );
}
