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
    expect(screen.queryByText(/Amounts doubled|Amounts halved/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2×" }));

    expect(screen.getByText("4 cups flour", { selector: "mark" })).toBeInTheDocument();
    expect(screen.getByText("salt to taste").closest("mark")).toBeNull();
    expect(screen.getByText("24 muffins", { selector: "mark" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Amounts doubled. Lines without a number stay the same.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "1×" }));

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.getByText("12 muffins")).toBeInTheDocument();
    expect(screen.queryByText(/Amounts doubled|Amounts halved/)).not.toBeInTheDocument();
    expect(document.querySelector(".recipe-scale-mark")).toBeNull();
  });

  it("resets to 1× when the recipe changes", async () => {
    const user = userEvent.setup();
    const view = render(recipe("sunday"));
    await user.click(screen.getByRole("button", { name: "½×" }));
    expect(screen.getByText("1 cup flour")).toBeInTheDocument();

    view.rerender(recipe("monday"));

    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.queryByText(/Amounts halved/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says when the ingredients have no amounts and still scales the yield", async () => {
    const user = userEvent.setup();
    render(
      <KitchenMethod
        makes="12 muffins"
        ingredients={["salt to taste"]}
        steps={["Stir."]}
        sourceTitle=""
        sourceUrl=""
      />,
    );

    await user.click(screen.getByRole("button", { name: "2×" }));

    expect(
      screen.getByText(
        "These ingredients don’t have amounts to change. The yield is doubled.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("salt to taste").closest("mark")).toBeNull();
    expect(screen.getByText("24 muffins", { selector: "mark" })).toBeInTheDocument();
  });

  it("hides batch size when nothing can scale", () => {
    render(
      <KitchenMethod
        makes="a generous plate"
        ingredients={["salt to taste", "pinch of cinnamon"]}
        steps={["Stir."]}
        sourceTitle=""
        sourceUrl=""
      />,
    );

    expect(screen.queryByText("Batch size")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2×" })).not.toBeInTheDocument();
    expect(screen.getByText("a generous plate")).toBeInTheDocument();
    expect(screen.getByText("salt to taste")).toBeInTheDocument();
  });
});
