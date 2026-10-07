import Link from "next/link";
import type { ReactNode } from "react";
import { type Faq, faqJsonLd, jsonLdScript } from "../lib/seo";

type SeoContentProps = {
  heading: string;
  children: ReactNode;
  faqs?: Faq[];
  /** Extra JSON-LD objects to emit alongside the FAQ schema. */
  jsonLd?: unknown[];
};

const modeLinks = [
  { href: "/", label: "Daily puzzle" },
  { href: "/casual", label: "Casual practice" },
  { href: "/multiplayer", label: "Multiplayer" },
];

/**
 * Server-rendered text below the game so search engines (and players who
 * scroll) get a real description of the page. The game itself is a client
 * component whose initial HTML is mostly controls.
 */
export default function SeoContent({
  heading,
  children,
  faqs,
  jsonLd = [],
}: SeoContentProps) {
  const schemas = faqs?.length ? [...jsonLd, faqJsonLd(faqs)] : jsonLd;
  return (
    <section className="seo-content" aria-labelledby="seo-content-heading">
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}
        />
      ))}
      <h2 id="seo-content-heading">{heading}</h2>
      {children}
      {faqs?.length ? (
        <>
          <h3>Frequently asked questions</h3>
          <dl className="seo-faq">
            {faqs.map(({ question, answer }) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      <nav className="seo-links" aria-label="More ways to play">
        {modeLinks.map(({ href, label }) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
