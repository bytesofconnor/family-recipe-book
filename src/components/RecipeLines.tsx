import { useEffect, useId, useRef, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  addLine,
  linesToText,
  moveLine,
  pasteIntoLine,
  removeLine,
  replaceLine,
  splitLine,
  textToLines,
} from "@/lib/recipeLines";

export function RecipeLines({
  legend,
  hint,
  value,
  onChange,
  placeholder,
  noun,
  autoCapitalize,
  children,
}: {
  legend: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  noun: "ingredient" | "step";
  autoCapitalize: "off" | "sentences";
  children?: ReactNode;
}) {
  const baseId = useId();
  const lines = textToLines(value);
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) {
      return;
    }
    pendingFocus.current = null;
    document.getElementById(`${baseId}-${index}`)?.focus();
  }, [baseId, value]);

  function commit(
    next: string[],
    focusIndex: number | null,
  ) {
    pendingFocus.current = focusIndex;
    onChange(linesToText(next));
  }

  const label = noun === "ingredient" ? "Ingredient" : "Step";

  return (
    <fieldset className="write-desk-lines">
      <legend className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep">
        {legend}
      </legend>
      <p className="mt-1 text-[15px] leading-6 text-ink-soft">{hint}</p>
      {children}
      <ul className="m-0 list-none p-0">
        {lines.map((line, index) => {
          const position = index + 1;
          return (
            <li key={`${baseId}-${index}`} className="write-desk-line">
              <label className="sr-only" htmlFor={`${baseId}-${index}`}>
                {label} {position}
              </label>
              <Input
                id={`${baseId}-${index}`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize={autoCapitalize}
                autoCorrect={noun === "step" ? "on" : "off"}
                spellCheck={noun === "step"}
                enterKeyHint="next"
                value={line}
                placeholder={index === 0 ? placeholder : undefined}
                onChange={(event) => {
                  commit(replaceLine(lines, index, event.target.value), null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                    return;
                  }
                  event.preventDefault();
                  const caret = event.currentTarget.selectionStart ?? line.length;
                  const result = splitLine(lines, index, caret);
                  commit(result.lines, result.focusIndex);
                }}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text");
                  const caret = event.currentTarget.selectionStart ?? line.length;
                  const result = pasteIntoLine(lines, index, text, caret);
                  if (!result.split) {
                    return;
                  }
                  event.preventDefault();
                  commit(result.lines, result.focusIndex);
                }}
              />
              {lines.length > 1 ? (
                <div className="write-desk-line-controls">
                  <button
                    type="button"
                    aria-label={`Move ${noun} ${position} up`}
                    disabled={index === 0}
                    onClick={() => {
                      const next = moveLine(lines, index, -1);
                      commit(next, next === lines ? null : index - 1);
                    }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${noun} ${position} down`}
                    disabled={index === lines.length - 1}
                    onClick={() => {
                      const next = moveLine(lines, index, 1);
                      commit(next, next === lines ? null : index + 1);
                    }}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${noun} ${position}`}
                    onClick={() => {
                      const next = removeLine(lines, index);
                      commit(next, Math.min(index, next.length - 1));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="book-press book-press-text write-desk-line-add"
        onClick={() => {
          const result = addLine(lines);
          if (linesToText(result.lines) === value) {
            document.getElementById(`${baseId}-${result.focusIndex}`)?.focus();
            return;
          }
          commit(result.lines, result.focusIndex);
        }}
      >
        Add another
      </button>
    </fieldset>
  );
}
