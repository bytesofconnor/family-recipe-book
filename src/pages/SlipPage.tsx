import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { BakePlate } from "@/components/BakePlate";
import { KitchenMethod } from "@/components/KitchenMethod";
import { SecretSauce } from "@/components/SecretSauce";
import { KIND_LABELS } from "../../convex/lib/kinds";
import { PageTitle } from "@/lib/pageTitle";

export function SlipPage() {
  const { token } = useParams();
  const recipe = useQuery(
    api.slips.open,
    token && token.length >= 16 ? { token } : "skip",
  );

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => {
      robots.remove();
    };
  }, []);

  if (!token || token.length < 16) {
    return (
      <div className="slip-shell">
        <PageTitle title="That slip isn’t here" />
        <article className="slip-sheet">
          <p className="text-[19px] leading-8 text-ink-soft">
            This slip doesn’t open. Ask for a new one.
          </p>
        </article>
      </div>
    );
  }

  if (recipe === undefined) {
    return (
      <div className="slip-shell">
        <PageTitle title="A recipe" />
        <p className="slip-sheet text-[18px] leading-8 text-ink-soft" role="status">
          Opening the slip…
        </p>
      </div>
    );
  }

  if (recipe === null) {
    return (
      <div className="slip-shell">
        <PageTitle title="That slip isn’t here" />
        <article className="slip-sheet">
          <p className="text-[19px] leading-8 text-ink-soft">
            This slip doesn’t open. Ask for a new one.
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="slip-shell">
      <PageTitle title={recipe.title} />
      <article className="slip-sheet">
        {recipe.photoUrl ? (
          <div className="book-portal-frame slip-frame">
            <div className="book-portal-frame-well">
              <img src={recipe.photoUrl} alt={recipe.title} />
            </div>
          </div>
        ) : (
          <div className="book-portal-frame slip-frame">
            <div className="book-portal-frame-well">
              <BakePlate kind={recipe.kind} seed={recipe.title} />
            </div>
          </div>
        )}
        <p className="mt-6 text-[16px] font-medium leading-6 text-ink-soft">
          {KIND_LABELS[recipe.kind]}
        </p>
        <h1 className="font-display mt-2 text-[2.15rem] leading-[1.12] tracking-tight md:text-[3rem]">
          {recipe.title}
        </h1>
        <div className="mt-8">
          <KitchenMethod
            shared
            key={token}
            makes={recipe.makes}
            ingredients={recipe.ingredients}
            steps={recipe.steps}
            method={recipe.method}
            sourceTitle={recipe.sourceTitle}
            sourceUrl={recipe.sourceUrl}
          />
        </div>
        {recipe.changes.length > 0 ? (
          <div className="mt-8">
            <SecretSauce shared changes={recipe.changes} />
          </div>
        ) : null}
      </article>
    </div>
  );
}
