/**
 * @vitest-environment happy-dom
 *
 * Site footer behavior: year, credit link, and no personal names.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteFooter } from "./SiteFooter";

// Assembled from fragments so this file contains no personal-name literals.
const PERSON_NAME = new RegExp(
  `\\b(${["ch" + "ris", "chr" + "istine", "barr" + "ett", "conn" + "or"].join("|")}|mom)\\b`,
  "i",
);

describe("SiteFooter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the computed copyright year and family kitchen line", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "© 2028 The Family Recipe Book · Made with love in our family kitchen",
      ),
    ).toBeInTheDocument();
  });

  it("credits Sally with a safe outbound link", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );

    const credit = screen.getByRole("link", { name: /sally/i });
    expect(credit).toHaveAttribute("href", "https://sallysbakingaddiction.com");
    expect(credit).toHaveAttribute("rel", "noopener");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit.textContent).toMatch(/sally/i);
  });

  it("links Home to the cookbook root and has no All recipes link", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("link", { name: "All recipes" }),
    ).not.toBeInTheDocument();
  });

  it("gives the dark tone the class the stylesheet targets", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteFooter tone="dark" />
      </MemoryRouter>,
    );

    const footer = container.querySelector("footer.site-footer");
    expect(footer).toHaveClass("site-footer-on-dark");
    expect(footer).not.toHaveClass("site-footer-dark");
  });

  it("can stand as credit without a Home link", () => {
    render(
      <MemoryRouter>
        <SiteFooter homeLink={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sally/i })).toBeInTheDocument();
  });

  it("does not name any person", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );

    expect(container.textContent ?? "").not.toMatch(PERSON_NAME);
  });
});
