/**
 * @vitest-environment happy-dom
 */

import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngredientParts } from "./IngredientParts";
import type { IngredientPart } from "../../convex/lib/ingredientLine";

const FLOUR: IngredientPart = {
  quantity: "½",
  unit: "cup",
  item: "flour",
  line: "½ cup flour",
  confidence: "high",
};

const SALT: IngredientPart = {
  quantity: "",
  unit: "",
  item: "salt",
  line: "salt",
  confidence: "low",
};

function Review() {
  const [parts, setParts] = useState<IngredientPart[]>([FLOUR, SALT]);
  return <IngredientParts parts={parts} onChange={setParts} />;
}

describe("ingredient review", () => {
  it("shows a low-confidence line and clears the flag when it is fixed", async () => {
    const user = userEvent.setup();
    render(<Review />);

    expect(screen.getByLabelText("Amount 1")).toHaveValue("½");
    expect(screen.getByLabelText("Unit 1")).toHaveValue("cup");
    expect(screen.getByLabelText("Ingredient 1")).toHaveValue("flour");
    expect(screen.getByText("Check this")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient 2")).toHaveValue("salt");

    await user.clear(screen.getByLabelText("Ingredient 2"));
    await user.type(screen.getByLabelText("Ingredient 2"), "pepper");

    expect(screen.getByLabelText("Ingredient 2")).toHaveValue("pepper");
    expect(screen.queryByText("Check this")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Amount 1")).toHaveValue("½");
  });
});
