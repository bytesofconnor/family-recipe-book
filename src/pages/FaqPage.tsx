import { useState } from "react";
import { Link } from "react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { PageTitle } from "@/lib/pageTitle";
import { SITE_SHORT } from "@/lib/site";
import { useFamily } from "@/lib/family";

const FAQS = [
  {
    q: "Who’s it for?",
    a: "Family, friends, and anyone else you want to share recipes with.",
  },
  {
    q: "Do I need Google?",
    a: "Yes. It keeps the book private and knows which kitchen is yours.",
  },
  { q: "Is it public?", a: "No. Family books are invite-only." },
  {
    q: "How do invites work?",
    a: "Sign in, open Your kitchen, and send your family a link.",
  },
  {
    q: "Can I start with a photo?",
    a: "Absolutely. Add the photo now and fill in the recipe whenever.",
  },
] as const;

export function FaqPage() {
  const { status } = useFamily();
  const signedIn = status === "in";
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="book-back-cover">
      <PageTitle title={`FAQ · ${SITE_SHORT}`} />
      <picture className="book-back-cover-art-picture" aria-hidden="true">
        <source
          media="(max-width: 639px)"
          srcSet="/themes/faq-recipe-box-mobile.webp"
        />
        <img
          className="book-back-cover-art"
          src="/themes/faq-recipe-box.webp"
          alt=""
        />
      </picture>
      <div className="book-back-body">
        <header className="book-back-intro">
          <p className="book-back-eyebrow">Five quick things</p>
          <h1 className="book-back-title">Before you open the book.</h1>
          <p className="book-back-deck">
            Private, simple, and made to share.
          </p>
        </header>
        <section className="book-back-list" aria-label="Frequently asked questions">
          {FAQS.map((item, index) => (
            <details
              key={item.q}
              className="book-back-item"
              open={openIndex === index}
            >
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setOpenIndex((current) => current === index ? null : index);
                }}
              >
                <span className="book-back-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="book-back-question">{item.q}</span>
                <span className="book-back-chevron" aria-hidden="true" />
              </summary>
              <p className="book-back-answer">{item.a}</p>
            </details>
          ))}
        </section>
        <footer className="book-back-footer">
          <p className="book-back-proof">That’s the whole recipe.</p>
          {!signedIn ? (
            <p className="book-back-cta">
              <Link to="/join" className="book-back-cta-link">
                <span aria-hidden="true">←</span>
                Front cover
              </Link>
            </p>
          ) : null}
        </footer>
        <SiteFooter tone="dark" homeLink={false} />
      </div>
    </div>
  );
}
