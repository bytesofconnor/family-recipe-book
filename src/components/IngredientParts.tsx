import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  formatIngredientLine,
  type IngredientPart,
} from "../../convex/lib/ingredientLine";

function updatePart(
  parts: IngredientPart[],
  index: number,
  patch: Partial<Pick<IngredientPart, "quantity" | "unit" | "item">>,
): IngredientPart[] {
  return parts.map((part, partIndex) => {
    if (partIndex !== index) return part;
    const next = { ...part, ...patch, confidence: "high" as const };
    return { ...next, line: formatIngredientLine(next) };
  });
}

export function IngredientParts({
  parts,
  onChange,
}: {
  parts: IngredientPart[];
  onChange: (parts: IngredientPart[]) => void;
}) {
  const baseId = useId();
  const rows = parts.length > 0 ? parts : [];

  return (
    <fieldset className="write-desk-lines">
      <legend className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep">
        What went in
      </legend>
      <p className="mt-1 text-[15px] leading-6 text-ink-soft">
        Amount, unit, then what it is. Leave the amount blank when there isn't
        one.
      </p>
      <ul className="m-0 list-none p-0">
        {rows.map((part, index) => {
          const position = index + 1;
          const unsure = part.confidence === "low";
          const amountId = `${baseId}-amount-${index}`;
          const unitId = `${baseId}-unit-${index}`;
          const itemId = `${baseId}-item-${index}`;
          return (
            <li
              key={`${baseId}-${index}`}
              className={
                unsure ? "write-desk-line write-desk-unsure" : "write-desk-line"
              }
            >
              {unsure ? (
                <p className="write-desk-check" id={`${baseId}-check-${index}`}>
                  Check this
                </p>
              ) : null}
              <div className="write-desk-part-grid">
                <div>
                  <label className="write-desk-part-label" htmlFor={amountId}>
                    Amount {position}
                  </label>
                  <Input
                    id={amountId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCapitalize="off"
                    value={part.quantity}
                    aria-describedby={
                      unsure ? `${baseId}-check-${index}` : undefined
                    }
                    onChange={(event) =>
                      onChange(
                        updatePart(parts, index, { quantity: event.target.value }),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="write-desk-part-label" htmlFor={unitId}>
                    Unit {position}
                  </label>
                  <Input
                    id={unitId}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    value={part.unit}
                    onChange={(event) =>
                      onChange(updatePart(parts, index, { unit: event.target.value }))
                    }
                  />
                </div>
                <div className="write-desk-part-item">
                  <label className="write-desk-part-label" htmlFor={itemId}>
                    Ingredient {position}
                  </label>
                  <Input
                    id={itemId}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    value={part.item}
                    onChange={(event) =>
                      onChange(updatePart(parts, index, { item: event.target.value }))
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                className="mt-2 min-h-11 cursor-pointer text-[17px] underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                onClick={() =>
                  onChange(
                    parts.length <= 1
                      ? [
                          {
                            quantity: "",
                            unit: "",
                            item: "",
                            line: "",
                            confidence: "high",
                          },
                        ]
                      : parts.filter((_, partIndex) => partIndex !== index),
                  )
                }
              >
                Take off ingredient {position}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="book-press book-press-text write-desk-line-add"
        onClick={() =>
          onChange([
            ...parts,
            { quantity: "", unit: "", item: "", line: "", confidence: "high" },
          ])
        }
      >
        Add another
      </button>
    </fieldset>
  );
}
