import Script from "next/script";
import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SCRIPT_SRC } from "../lib/analytics";

export default function Analytics() {
  if (!PLAUSIBLE_DOMAIN) return null;
  return (
    <>
      <Script
        id="plausible-queue"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};",
        }}
      />
      <Script
        src={PLAUSIBLE_SCRIPT_SRC}
        data-domain={PLAUSIBLE_DOMAIN}
        strategy="afterInteractive"
      />
    </>
  );
}
