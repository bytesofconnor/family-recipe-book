import { Link } from "react-router";
import { SITE_NAME } from "@/lib/site";

export const SALLY_HOME = "https://sallysbakingaddiction.com";

export function SiteFooter({
  tone = "paper",
  homeLink = true,
}: {
  tone?: "paper" | "dark";
  homeLink?: boolean;
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={
        tone === "dark" ? "site-footer site-footer-on-dark" : "site-footer"
      }
    >
      <p className="site-footer-copy">
        © {year} {SITE_NAME} · Made with love in our family kitchen
      </p>
      <p className="site-footer-credit">
        These are our family&apos;s own versions, inspired by{" "}
        <a href={SALLY_HOME} rel="noopener" target="_blank">
          Sally&apos;s Baking Addiction
        </a>
        .
      </p>
      {homeLink ? (
        <nav className="site-footer-nav" aria-label="Footer">
          <Link to="/">Home</Link>
        </nav>
      ) : null}
    </footer>
  );
}
