import ProgressTransfer from "../../components/ProgressTransfer";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = {
  ...buildPageMetadata({
    title: "Move Your Progress to Another Device",
    description:
      "Copy your Blocker Rush streak and solve times to another phone or computer with a link. No account needed.",
    path: "/transfer",
  }),
  // A utility page: nothing for search results.
  robots: { index: false, follow: true },
};

export default function TransferPage() {
  return <ProgressTransfer />;
}
