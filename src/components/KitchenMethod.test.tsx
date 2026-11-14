/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KitchenMethod } from "./KitchenMethod";

function recipe(recipeKey: string) {
  return (
    <KitchenMethod
      key={recipeKey}
      makes="12 muffins"
      ingredients={["2 cups flour", "salt to taste"]}
      steps={["Heat the oven."]}
      sourceTitle=""
      sourceUrl=""
    />
  );
}

describe("KitchenMethod batch size", () => {
  it("changes the displayed amounts and returns to the original at 1×", async () => {
    const user = userEvent.setup();
    render(recipe("sunday"));

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.getByText("salt to taste")).toBeInTheDocument();
    expect(screen.getByText("12 muffins")).toBeInTheDocument();
    expect(screen.queryByText(/Amounts are for/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2×" }));

    expect(screen.getByText("4 cups flour")).toBeInTheDocument();
    expect(screen.getByText("salt to taste")).toBeInTheDocument();
    expect(screen.getByText("24 muffins")).toBeInTheDocument();
    expect(
      screen.getByText("Amounts are for double the recipe. This makes 24 muffins."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "1×" }));

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.getByText("12 muffins")).toBeInTheDocument();
    expect(screen.queryByText(/Amounts are for/)).not.toBeInTheDocument();
  });

  it("resets to 1× when the recipe changes", async () => {
    const user = userEvent.setup();
    const view = render(recipe("sunday"));
    await user.click(screen.getByRole("button", { name: "½×" }));
    expect(screen.getByText("1 cup flour")).toBeInTheDocument();

    view.rerender(recipe("monday"));

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.queryByText(/Amounts are for/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
