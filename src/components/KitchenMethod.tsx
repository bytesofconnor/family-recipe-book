import { useId, useState } from "react";
import { Kicker } from "@/components/Kicker";
import {
  SCALE_CHOICES,
  type ScaleFactor,
  batchNote,
  recipeCanScale,
  scaleAmountText,
} from "@/lib/scaleAmount";

function ScaledText({ text, factor }: { text: string; factor: ScaleFactor }) {
  const shown = scaleAmountText(text, factor);
  if (factor === 1 || shown === text) return shown;
  return <mark className="recipe-scale-mark">{shown}</mark>;
}

export function KitchenMethod({
  makes,
  ingredients,
  steps,
  method,
  prepTime,
  cookTime,
  sourceTitle,
  sourceUrl,
  shared = false,
}: {
  makes?: string;
  ingredients?: string[];
  steps?: string[];
  method?: string;
  prepTime?: string;
  cookTime?: string;
  sourceTitle: string;
  sourceUrl: string;
  shared?: boolean;
}) {
  const [scale, setScale] = useState<ScaleFactor>(1);
  const scaleLabelId = useId();
  const whatWentIn = (ingredients ?? []).map((line) => line.trim()).filter(Boolean);
  const how = (steps ?? []).map((line) => line.trim()).filter(Boolean);
  const prose = method?.trim() ?? "";
  const hasLists = whatWentIn.length > 0 || how.length > 0;

  if (!hasLists && prose.length === 0) {
    return null;
  }

  const blocks = prose.split("\n\n").filter((block) => block.length > 0);
  const canScale = recipeCanScale(makes, whatWentIn);
  const shownScale: ScaleFactor = canScale ? scale : 1;
  const note = canScale ? batchNote(shownScale, makes, whatWentIn) : null;
  const yieldText = makes?.trim() ?? "";
  const timeBits = [
    prepTime?.trim() ? `Prep ${prepTime.trim()}` : "",
    cookTime?.trim() ? `Cook ${cookTime.trim()}` : "",
  ].filter((bit) => bit.length > 0);
  const timeLine = timeBits.join(" · ");

  return (
    <section
      aria-labelledby="kitchen-method-heading"
      className="kitchen-method w-full rounded-lg border border-rule border-l-[3px] border-l-cinnamon bg-paper-raised px-3.5 py-5 md:px-7 md:py-7"
    >
      <Kicker>The recipe</Kicker>
      <h2
        id="kitchen-method-heading"
        className="font-display mt-1 text-[1.65rem] leading-8"
      >
        {shared ? "How to make it" : "How we made it"}
      </h2>
      {canScale ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              id={scaleLabelId}
              className="text-[16px] leading-6 text-ink-soft"
            >
              Batch size
            </span>
            <div
              role="group"
              aria-labelledby={scaleLabelId}
              className="flex flex-wrap gap-1.5"
            >
              {SCALE_CHOICES.map((choice) => {
                const pressed = scale === choice.factor;
                return (
                  <button
                    key={choice.factor}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => setScale(choice.factor)}
                    className={`recipe-scale-choice inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border-cocoa px-3 text-[17px] leading-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-cinnamon-deep ${
                      pressed
                        ? "border-[3px] bg-cocoa font-medium text-paper-raised"
                        : "border-[1.5px] bg-transparent font-medium text-ink hover:bg-paper-press"
                    }`}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className={`recipe-scale-note text-[16px] leading-6 text-cocoa ${note ? "mt-2" : ""}`}
            aria-live="polite"
          >
            {note ?? ""}
          </p>
        </div>
      ) : null}
      {yieldText ? (
        <p className="mt-3 font-display text-[1.35rem] leading-8 text-cocoa">
          <ScaledText text={yieldText} factor={shownScale} />
        </p>
      ) : null}
      {timeLine ? (
        <p className="mt-1 text-[17px] leading-7 text-ink-soft">{timeLine}</p>
      ) : null}

      {hasLists ? (
        <div className="kitchen-method-cols">
          {whatWentIn.length > 0 ? (
            <div className="kitchen-method-what">
              <h3 className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep">
                What went in
              </h3>
              <ul className="mt-3 flex flex-col">
                {whatWentIn.map((line, index) => (
                  <li
                    key={`${index}-${line}`}
                    className="border-t border-rule/80 py-2.5 text-[18px] leading-7 first:border-t-0 first:pt-0 last:pb-0"
                  >
                    <ScaledText text={line} factor={shownScale} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {how.length > 0 ? (
            <div className="kitchen-method-how">
              <h3 className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep">
                How
              </h3>
              <ol className="mt-3 flex flex-col">
                {how.map((line, index) => (
                  <li
                    key={line}
                    className="flex gap-3 border-t border-rule/80 py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className="font-display w-6 shrink-0 text-[1.15rem] leading-7 text-cinnamon-deep"
                    >
                      {index + 1}
                    </span>
                    <span className="text-[18px] leading-7">{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex max-w-[40rem] flex-col gap-4">
          {blocks.map((block) => (
            <p key={block} className="whitespace-pre-wrap text-[19px] leading-8">
              {block}
            </p>
          ))}
        </div>
      )}

      {sourceUrl.startsWith("http") && sourceTitle ? (
        <p className="mt-6 border-t border-rule pt-4 text-[16px] leading-7 text-ink-soft">
          {shared ? "Started from " : "Started from Sally's "}
          <a
            href={sourceUrl}
            className="text-ink underline decoration-rule decoration-2 underline-offset-[3px] transition-colors duration-150 hover:text-cinnamon-deep hover:decoration-cinnamon-deep active:text-cocoa active:decoration-cocoa"
          >
            {sourceTitle}
          </a>
          .
        </p>
      ) : null}
    </section>
  );
}
