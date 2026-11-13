import type { Ref } from "react";
import { useLocation } from "react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WarmPages } from "@/components/WarmPages";
import { BookHeadingProvider } from "@/lib/bookHeading";
import { sectionOf } from "@/lib/bookPages";
import { SITE_LINE, SITE_SHORT } from "@/lib/site";

export function BookChrome({ pathname }: { pathname?: string }) {
  const location = useLocation();
  const path = pathname ?? location.pathname;
  const recipeLeaf = path.startsWith("/bakes/");

  return (
    <div
      className="book-chrome"
      data-recipe-leaf={recipeLeaf ? "true" : undefined}
    >
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to the recipe book
      </a>
      {recipeLeaf ? null : <SiteHeader pathname={path} />}
    </div>
  );
}

function colophonAside(pathname: string): string | null {
  const section = sectionOf(pathname);
  if (section === "cookbook") {
    if (pathname.startsWith("/bakes/")) {
      return null;
    }
    return "Recipes from this kitchen";
  }
  if (section === "add") {
    return "Writing into the book";
  }
  if (section === "you") {
    return "Your kitchen";
  }
  if (section === "family") {
    return "Family in the book";
  }
  if (section === "faq") {
    return "A few answers";
  }
  if (section === "join") {
    return "Come in";
  }
  return SITE_LINE;
}

export function BookColophon({ pathname }: { pathname: string }) {
  const aside = colophonAside(pathname);

  return (
    <footer className="book-colophon">
      <div className="book-colophon-brand">
        <img
          src="/favicon.svg"
          alt=""
          width={22}
          height={22}
          className="book-colophon-mark"
          decoding="async"
        />
        <div className="book-colophon-copy">
          <p className="book-colophon-title">{SITE_SHORT}</p>
          {aside ? <p className="book-colophon-aside">{aside}</p> : null}
        </div>
      </div>
      {/* Keep the footer's right slot so the brand line does not jump.
          The old digits were a hash of the route, not a page you can turn to. */}
      <p className="book-colophon-page" aria-hidden="true">
        <span className="book-colophon-page-rule" />
        <span className="book-colophon-page-dot" />
        <span className="book-colophon-page-rule" />
      </p>
    </footer>
  );
}

export function BookFace({
  pathname,
  faceRef,
}: {
  pathname: string;
  faceRef?: Ref<HTMLDivElement>;
}) {
  const section = sectionOf(pathname);
  // Public join/FAQ paint their own footer on the cover or back board.
  // The write desk stays a working page — no extra chrome under the form.
  const showSiteFooter =
    section !== "add" && section !== "faq" && section !== "join";

  return (
    <BookHeadingProvider>
      <div className="book-face" ref={faceRef}>
        <BookChrome pathname={pathname} />
        <div className="book-sheet-inner">
          <main id="main" className="book-page-body" tabIndex={-1}>
            <WarmPages pathname={pathname} />
          </main>
        </div>
        <BookColophon pathname={pathname} />
        {showSiteFooter ? <SiteFooter /> : null}
      </div>
    </BookHeadingProvider>
  );
}
