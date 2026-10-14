import { notFound } from "next/navigation";
import { getDailyDifficulty, getDateKey } from "@blocker-rush/shared";
import DailyGame from "../../../components/DailyGame";
import SeoContent from "../../../components/SeoContent";
import {
  archiveDateKeys,
  isArchiveDateKey,
} from "../../../components/dailyArchive";
import { parseDateKey } from "../../../components/dailyStats";
import { breadcrumbJsonLd, buildPageMetadata } from "../../../lib/seo";

type Params = { params: { date: string } };

// Static export: one page per day, from the archive start to a week past
// the build date, so a page exists for "yesterday" in every time zone and
// a few missed deploys don't break anything. The Pages workflow rebuilds
// daily to keep adding days. Every date's page is identical for every
// visitor; whether a date is in the visitor's future is decided
// client-side. Any other date gets the 404 page.
const BUILD_AHEAD_DAYS = 7;

export const dynamicParams = false;
export function generateStaticParams() {
  const last = new Date();
  last.setDate(last.getDate() + BUILD_AHEAD_DAYS);
  return archiveDateKeys(getDateKey(last)).map((date) => ({ date }));
}

const longDate = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export function generateMetadata({ params }: Params) {
  if (!isArchiveDateKey(params.date)) return {};
  const difficulty = getDailyDifficulty(parseDateKey(params.date));
  return buildPageMetadata({
    title: `Daily Puzzle for ${longDate(params.date)}`,
    description: `Play the Blocker Rush daily puzzle from ${longDate(params.date)}, a ${difficulty} board. Fit 9 pieces around 7 blockers on a 6×6 grid in this free Genius Square–style logic puzzle.`,
    path: `/daily/${params.date}`,
  });
}

export default function ArchiveDayPage({ params }: Params) {
  const dateKey = params.date;
  if (!isArchiveDateKey(dateKey)) notFound();
  const difficulty = getDailyDifficulty(parseDateKey(dateKey));
  return (
    <>
      <DailyGame archiveDateKey={dateKey} />
      <SeoContent
        heading={`Blocker Rush daily puzzle: ${longDate(dateKey)}`}
        jsonLd={[
          breadcrumbJsonLd(
            ["Past daily puzzles", "/daily"],
            [longDate(dateKey), `/daily/${dateKey}`],
          ),
        ]}
      >
        <p>
          This is the {difficulty} Blocker Rush daily puzzle from{" "}
          {longDate(dateKey)}. Fit all nine pieces into the 6×6 board around
          the seven blockers. Solving a past puzzle doesn&apos;t affect your
          streak, so take your time, or race the clock to beat your friends.
        </p>
      </SeoContent>
    </>
  );
}
