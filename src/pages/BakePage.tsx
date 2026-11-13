import { useQuery } from "convex/react";
import { useParams, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { Kicker } from "@/components/Kicker";
import { PageTurn } from "@/components/PageTurn";
import { BakePlate } from "@/components/BakePlate";
import { BakerAvatar } from "@/components/BakerAvatar";
import { PhotoFrame } from "@/components/PhotoFrame";
import { PhotoGallery } from "@/components/PhotoGallery";
import { RecipeSource } from "@/components/RecipeSource";
import { SecretSauce } from "@/components/SecretSauce";
import { CookbookBack } from "@/components/CookbookBack";
import { RecipeShare } from "@/components/RecipeShare";
import { RecipeEdit } from "@/components/RecipeEdit";
import { RecipeDelete } from "@/components/RecipeDelete";
import { KitchenMethod } from "@/components/KitchenMethod";
import { KitchenAsk } from "@/components/KitchenAsk";
import { formatBakeDate } from "@/lib/dates";
import { inferKind, KIND_LABELS } from "../../convex/lib/kinds";
import { PageTitle } from "@/lib/pageTitle";
import { SITE_NAME, SITE_SHORT } from "@/lib/site";
import { useFamily } from "@/lib/family";
import { useRecipeTitle } from "@/lib/bookHeading";
import { RedirectToJoin } from "@/components/RedirectToJoin";
import { useCookbookView } from "@/lib/preview";

/** A drop cap needs a paragraph beside it. A short note splits into a stray initial. */
const DROP_CAP_MIN = 90;

function leadClass(text: string): string | undefined {
  return text.trim().length >= DROP_CAP_MIN ? "drop-cap" : undefined;
}

export function BakePage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { status } = useFamily();
  const view = useCookbookView();
  const bake = useQuery(
    api.bakes.getPublishedBySlug,
    status === "in" && slug ? { slug } : "skip",
  );
  const catalog = view.bakes;
  const teaser = catalog?.find((item) => item.slug === slug);
  const photos = useQuery(
    api.photos.listForBake,
    bake ? { bakeId: bake._id } : "skip",
  );
  useRecipeTitle(
    (bake && "title" in bake ? bake.title : null) ?? teaser?.title ?? null,
  );

  if (status === "checking") {
    return (
      <>
        <PageTitle title={SITE_NAME} />
        <p role="status">Opening this bake…</p>
      </>
    );
  }

  if (status === "out") {
    return <RedirectToJoin />;
  }

  if (bake === undefined) {
    return (
      <>
        <PageTitle title={SITE_NAME} />
        <p role="status">Opening this bake…</p>
      </>
    );
  }

  if (bake === null) {
    return (
      <>
        <PageTitle title={`Not in the recipe book · ${SITE_SHORT}`} />
        <p className="text-ink-soft">That card isn&apos;t in the book.</p>
        <p className="mt-6">
          <CookbookBack />
        </p>
      </>
    );
  }

  // Ensure cover photo is first in gallery
  const sortedPhotos = photos && photos.length > 0 && bake.coverStorageId
    ? [
        ...photos.filter((p) => p.storageId === bake.coverStorageId),
        ...photos.filter((p) => p.storageId !== bake.coverStorageId),
      ]
    : photos || [];

  const hero = sortedPhotos[0];
  const heroSrc = hero?.url ?? bake.coverUrl;
  const heroAlt = hero?.alt || bake.title;
  const [firstParagraph, ...restParagraphs] = bake.story
    .split("\n")
    .filter((line) => line.length > 0);
  const index = catalog?.findIndex((item) => item._id === bake._id) ?? -1;
  const newer = index > 0 ? catalog?.[index - 1] : null;
  const older = index >= 0 ? catalog?.[index + 1] : null;

  const kind = bake.kind ?? inferKind(bake.title, bake.sourceTitle);
  const hasIntro =
    Boolean(firstParagraph) ||
    restParagraphs.length > 0 ||
    Boolean(bake.outcome);

  // Prepare photos for gallery (filter out null URLs, already sorted by cover)
  const galleryPhotos =
    sortedPhotos.length > 0
      ? sortedPhotos.filter((p) => p.url).map((p) => ({ url: p.url!, alt: p.alt }))
      : [];

  return (
    <article className="bake-leaf">
      <PageTitle title={`${bake.title} · ${SITE_SHORT}`} />
      <div className="bake-leaf-bar">
        <CookbookBack />
        <div className="bake-leaf-actions">
          <RecipeShare bakeId={bake._id} title={bake.title} />
          <RecipeEdit
            bakeId={bake._id}
            title={bake.title}
            ownerId={bake.ownerId}
          />
          <RecipeDelete
            bakeId={bake._id}
            title={bake.title}
            ownerId={bake.ownerId}
          />
        </div>
      </div>

      <header className="bake-leaf-hero">
        <div className="bake-leaf-hero-photo">
          {galleryPhotos.length > 0 ? (
            <PhotoGallery photos={galleryPhotos} title={bake.title} />
          ) : heroSrc ? (
            <PhotoFrame src={heroSrc} alt={heroAlt} size="hero" />
          ) : (
            <div className="book-portal-frame book-plate-hero">
              <div className="book-portal-frame-well">
                <BakePlate kind={kind} seed={bake.slug} />
              </div>
            </div>
          )}
        </div>
        <div className="bake-leaf-hero-copy">
          <Kicker className="bake-leaf-kicker">
            <span className="bake-leaf-kicker-kind">{KIND_LABELS[kind]}</span>
            <span className="bake-leaf-kicker-sep" aria-hidden="true">
              ·
            </span>
            <span className="bake-leaf-baker">
              <BakerAvatar
                name={bake.bakerName}
                url={bake.bakerAvatarUrl}
                size="sm"
              />
              {bake.bakerName}
            </span>
            <span className="bake-leaf-kicker-sep" aria-hidden="true">
              ·
            </span>
            <time dateTime={bake.bakedOn}>{formatBakeDate(bake.bakedOn)}</time>
          </Kicker>
          <h1 className="bake-leaf-title">{bake.title}</h1>
          <RecipeSource
            sourceKind={bake.sourceKind}
            sourceTitle={bake.sourceTitle}
            sourceUrl={bake.sourceUrl}
          />
        </div>
      </header>

      {hasIntro ? (
        <div className="bake-leaf-intro">
          {firstParagraph ? (
            <p className={leadClass(firstParagraph)}>{firstParagraph}</p>
          ) : null}
          {restParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {bake.outcome ? (
            <p className="bake-leaf-outcome">{bake.outcome}</p>
          ) : null}
        </div>
      ) : null}

      <div className="bake-leaf-method">
        <KitchenMethod
          makes={bake.makes}
          ingredients={bake.ingredients}
          steps={bake.steps}
          method={bake.method}
          sourceTitle={bake.sourceTitle}
          sourceUrl={bake.sourceUrl}
        />
      </div>

      <SecretSauce changes={bake.changes} />

      <KitchenAsk
        title={bake.title}
        sourceTitle={bake.sourceTitle}
        bakerName={bake.bakerName}
        outcome={bake.outcome}
        changes={bake.changes}
        ingredients={bake.ingredients}
        steps={bake.steps}
      />

      <PageTurn older={older} newer={newer} search={params.toString()} />
    </article>
  );
}
