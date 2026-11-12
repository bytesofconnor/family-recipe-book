import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useBlocker, useNavigate, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router";
import { BookConfirm } from "@/components/BookConfirm";
import { PhotoManager } from "@/components/PhotoManager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Kicker } from "@/components/Kicker";
import { formatBakeDate } from "@/lib/dates";
import { PageTitle } from "@/lib/pageTitle";
import { BAKER_NAME, SITE_SHORT } from "@/lib/site";
import { DESK_PATH } from "@/lib/desk";
import { linesFromText } from "@/lib/recipe";
import {
  SOURCE_KINDS,
  SOURCE_LABELS,
  sourceLink,
  sourceNote,
  type SourceKind,
} from "@/lib/sources";
import { kindFromUrl } from "../../convex/lib/sources";
import { useToast } from "@/lib/toast";
import { photosFromPicker, uploadContentType } from "@/lib/photoFiles";
import { downscalePhoto } from "@/lib/downscalePhoto";
import {
  CHANGE_MOVES,
  MAKES_HINT,
  changeHint,
  houseTitleFromSally,
  isSallyUrl,
  normalizeSallyUrl,
  readyChanges,
  trayFor,
  type ChangeRow,
} from "@/lib/writeDesk";

function messageFrom(caught: unknown, fallback: string): string {
  if (caught instanceof TypeError) {
    return fallback;
  }
  if (caught instanceof Error && caught.message.length > 0) {
    return caught.message;
  }
  return fallback;
}

type ScanKind = "photo" | "file" | "link";

type ReadFields = {
  title: boolean;
  ingredients: boolean;
  steps: boolean;
  story: boolean;
};

const EMPTY_READ: ReadFields = {
  title: false,
  ingredients: false,
  steps: false,
  story: false,
};

function titleFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return stem.length >= 2 ? stem : "";
}

function scanSummary(input: {
  kind: ScanKind;
  photoCount: number;
  many: number;
  usedAi: boolean;
  hasWords: boolean;
  titleOnly: boolean;
  partial: boolean;
}): string {
  if (input.many > 1) {
    return input.usedAi
      ? `Found ${input.many} recipes. Leave out any you don’t want, then put the rest in the book.`
      : `Pulled ${input.many} recipes off the file. Check them before they go in.`;
  }
  if (input.photoCount > 1) {
    if (input.usedAi && (input.hasWords || input.titleOnly)) {
      return "Read across the photos. Tap one if it should be the cover. Change anything that's wrong.";
    }
    if (input.hasWords) {
      return `Uploaded ${input.photoCount} photos. Tap one if it should be the cover. Check the recipe before saving.`;
    }
    return `Uploaded ${input.photoCount} photos. Tap one if it should be the cover. Couldn't read words on them. You can still save it.`;
  }
  if (input.usedAi && input.hasWords && !input.partial && !input.titleOnly) {
    const where =
      input.kind === "link"
        ? "the link"
        : input.kind === "photo"
          ? "the photo"
          : "the file";
    return `Filled in from ${where}. Change anything that's wrong.`;
  }
  if (input.titleOnly || input.partial) {
    return "Filled in what I could read. Blank lines are fine.";
  }
  if (input.hasWords) {
    return "Pulled the words off the file. Check them.";
  }
  if (input.kind === "link") {
    return "Couldn't read words on this link. You can still save it.";
  }
  return "Couldn't read words on this. You can still save it.";
}

function ReadFromLine({ from, show }: { from: ScanKind | null; show: boolean }) {
  if (!from || !show) {
    return null;
  }
  const where =
    from === "photo" ? "the photo" : from === "link" ? "the link" : "the file";
  return (
    <p className="mt-1 text-[15px] leading-6 text-ink-soft">
      Read from {where}. Change it if it&apos;s wrong.
    </p>
  );
}

type ChangeDraft = ChangeRow & { id: string };

type Screen = "choose" | "tray" | "card";
type Intake = "photo" | "file" | "link" | "type";

type DraftCard = {
  title: string;
  makes: string;
  ingredients: string;
  steps: string;
  sourceKind: SourceKind;
  sourceTitle: string;
  notes: string;
  keep: boolean;
};

type IntakeShot = {
  storageId: Id<"_storage">;
  previewUrl: string;
};

function CoverChoices({
  shots,
  coverPick,
  onPick,
}: {
  shots: IntakeShot[];
  coverPick: number | null;
  onPick: (index: number) => void;
}) {
  const hintId = useId();
  return (
    <fieldset className="write-desk-cover-pick">
      <legend className="text-[17px] leading-7 text-ink">Cover photo</legend>
      <p id={hintId} className="mt-1 text-[17px] leading-7 text-ink-soft">
        Tap a photo to use it as the cover. Leave them all as pages if none is
        the dish.
      </p>
      <ul className="write-desk-cover-grid" aria-describedby={hintId}>
        {shots.map((shot, index) => {
          const selected = coverPick === index;
          const photoNumber = index + 1;
          return (
            <li key={`${shot.storageId}-${index}`}>
              <button
                type="button"
                className={
                  selected
                    ? "write-desk-cover-choice is-cover"
                    : "write-desk-cover-choice"
                }
                aria-pressed={selected}
                onClick={() => onPick(index)}
              >
                <img src={shot.previewUrl} alt="" />
                <span className="write-desk-cover-choice-label">
                  {selected
                    ? `Cover, photo ${photoNumber}`
                    : `Use as cover, photo ${photoNumber}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function WriteDesk({
  token,
  kitchenId,
  bakerName = BAKER_NAME,
  onLock,
  onPublished,
}: {
  token?: string;
  kitchenId?: Id<"kitchens">;
  bakerName?: string;
  onLock?: () => Promise<void>;
  /** Parent remounts a blank desk after a successful publish. */
  onPublished?: () => void;
}) {
  const writeAccess = {
    ...(token ? { writerToken: token } : {}),
    ...(kitchenId ? { kitchenId } : {}),
  };
  const saveBake = useMutation(api.bakes.save);
  const updateBake = useMutation(api.bakes.updateMine);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const lookupCredit = useAction(api.sallyCredit.lookupCredit);
  const extractCard = useAction(api.extractCard.fromUpload);
  const extractFromLink = useAction(api.extractCard.fromLink);
  const mine = useQuery(
    api.bakes.listMine,
    token || kitchenId ? writeAccess : "skip",
  );
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const editParam = params.get("edit");
  const editBakeId =
    editParam && editParam.length > 0
      ? (editParam as Id<"bakes">)
      : null;
  const editBake = useQuery(
    api.bakes.getMineForEdit,
    editBakeId ? { bakeId: editBakeId } : "skip",
  );
  const editPhotos = useQuery(
    api.photos.listForBake,
    editBakeId ? { bakeId: editBakeId } : "skip",
  );
  const formErrorId = useId();
  const photoId = useId();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const hydratedEdit = useRef<Id<"bakes"> | null>(null);

  const [screen, setScreen] = useState<Screen>("choose");
  const [intake, setIntake] = useState<Intake>("type");
  const [sourceKind, setSourceKind] = useState<SourceKind>("original");
  const [title, setTitle] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [lookupState, setLookupState] = useState<
    "idle" | "looking" | "found" | "miss"
  >("idle");
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [readFrom, setReadFrom] = useState<ScanKind | null>(null);
  const [readFields, setReadFields] = useState<ReadFields>(EMPTY_READ);
  const [intakeShots, setIntakeShots] = useState<IntakeShot[]>([]);
  const [coverPick, setCoverPick] = useState<number | null>(null);
  const [story, setStory] = useState("");
  const [bakedOn, setBakedOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [showDate, setShowDate] = useState(false);
  const [changes, setChanges] = useState<ChangeDraft[]>([]);
  const changeSerial = useRef(0);
  const [makes, setMakes] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [originStorageId, setOriginStorageId] = useState<Id<"_storage"> | null>(
    null,
  );
  const [originIsImage, setOriginIsImage] = useState(false);
  const [originPreview, setOriginPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pile, setPile] = useState<DraftCard[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingBakeId, setEditingBakeId] = useState<Id<"bakes"> | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [coverCleared, setCoverCleared] = useState(false);
  const allowLeave = useRef(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  const deskDirty =
    editingBakeId !== null ||
    screen !== "choose" ||
    pile.length > 0 ||
    title.trim().length > 0 ||
    story.trim().length > 0 ||
    ingredients.trim().length > 0 ||
    steps.trim().length > 0 ||
    originStorageId !== null ||
    photoFile !== null;

  const leaveTitle = editingBakeId ? "Leave this edit?" : "Leave this recipe?";
  const leaveBody = editingBakeId
    ? "Your changes won’t be saved."
    : pile.length > 1
      ? "None of these recipes will be saved."
      : "What you typed here won’t be saved.";

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowLeave.current || !deskDirty) {
      return false;
    }
    if (currentLocation.pathname !== DESK_PATH) {
      return false;
    }
    if (nextLocation.pathname !== DESK_PATH) {
      return true;
    }
    const curEdit = new URLSearchParams(currentLocation.search).get("edit");
    const nextEdit = new URLSearchParams(nextLocation.search).get("edit");
    return Boolean(curEdit && curEdit !== nextEdit);
  });

  useEffect(() => {
    if (blocker.state === "blocked") {
      setLeaveOpen(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!deskDirty) {
      return;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [deskDirty]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photoFile]);

  useEffect(() => {
    if (!editBakeId) {
      hydratedEdit.current = null;
      return;
    }
    if (editBake === undefined) {
      return;
    }
    if (editBake === null) {
      setError("That recipe isn’t yours to edit.");
      const next = new URLSearchParams(params);
      next.delete("edit");
      setParams(next, { replace: true });
      return;
    }
    if (hydratedEdit.current === editBake._id) {
      return;
    }
    hydratedEdit.current = editBake._id;
    changeSerial.current = 0;
    setEditingBakeId(editBake._id);
    setEditingSlug(editBake.slug);
    setScreen("card");
    setIntake("type");
    setSourceKind(editBake.sourceKind ?? "original");
    setTitle(editBake.title);
    setSourceTitle(editBake.sourceTitle);
    setSourceUrl(editBake.sourceUrl);
    setTitleTouched(true);
    setLookupState("idle");
    setExtractNote(null);
    setStory(editBake.story);
    setBakedOn(editBake.bakedOn);
    setShowDate(true);
    setChanges(
      editBake.changes.map((change) => {
        changeSerial.current += 1;
        return {
          id: `change-${changeSerial.current}`,
          move: change.move,
          change: change.change,
          why: change.why,
        };
      }),
    );
    setMakes(editBake.makes ?? "");
    setIngredients(editBake.ingredients.join("\n"));
    setSteps(editBake.steps.join("\n"));
    setOriginStorageId(editBake.originStorageId ?? null);
    setOriginIsImage(Boolean(editBake.photoUrl));
    setOriginPreview(editBake.photoUrl);
    setPhotoFile(null);
    setIntakeShots([]);
    setCoverPick(null);
    setCoverCleared(false);
    setPile([]);
    setEditingIndex(null);
    setError(null);
  }, [editBake, editBakeId, params, setParams]);

  useEffect(() => {
    if (
      sourceKind === "family" ||
      sourceKind === "book" ||
      sourceKind === "friend"
    ) {
      return;
    }
    const fromUrl = kindFromUrl(sourceUrl);
    if (fromUrl && fromUrl !== sourceKind) {
      setSourceKind(fromUrl);
    }
  }, [sourceKind, sourceUrl]);

  useEffect(() => {
    if (sourceKind !== "sally") {
      return;
    }
    const url = normalizeSallyUrl(sourceUrl);
    if (!isSallyUrl(url)) {
      setLookupState(sourceUrl.trim().length > 8 ? "miss" : "idle");
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLookupState("looking");
      void lookupCredit({ ...writeAccess, url })
        .then((result) => {
          if (cancelled) {
            return;
          }
          if (!result.hostOk) {
            setLookupState("miss");
            return;
          }
          if (result.title) {
            setSourceTitle(result.title);
            setTitle((current) =>
              titleTouched || current.trim().length > 0
                ? current
                : houseTitleFromSally(result.title ?? ""),
            );
            setLookupState("found");
            return;
          }
          setLookupState("miss");
        })
        .catch(() => {
          if (!cancelled) {
            setLookupState("miss");
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [lookupCredit, sourceKind, sourceUrl, titleTouched, token, kitchenId]);

  const fieldSnap = useRef({
    title: "",
    ingredients: "",
    steps: "",
    story: "",
    makes: "",
    titleTouched: false,
  });
  fieldSnap.current = { title, ingredients, steps, story, makes, titleTouched };
  const linkScan = useRef(extractFromLink);
  linkScan.current = extractFromLink;

  useEffect(() => {
    if (intake !== "link" || kindFromUrl(sourceUrl) === "sally") {
      return;
    }
    const url = sourceUrl.trim();
    if (!/^https?:\/\//i.test(url) || url.length < 12) {
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setExtractNote("Reading that link…");
      void linkScan.current({ ...writeAccess, url })
        .then((result) => {
          if (cancelled) {
            return;
          }
          const card = result.cards[0];
          const empty =
            !card ||
            (card.title.trim().length < 2 &&
              card.ingredients.length === 0 &&
              card.steps.length === 0 &&
              (card.notes ?? "").trim().length === 0);
          if (result.skipped || empty) {
            if (result.skipped) {
              setExtractNote((note) =>
                note === "Reading that link…" ? null : note,
              );
              return;
            }
            setReadFrom(null);
            setReadFields(EMPTY_READ);
            setExtractNote(
              "Couldn't read words on this link. You can still save it.",
            );
            return;
          }
          const snap = fieldSnap.current;
          const draft = draftsFromExtract([card])[0];
          if (!draft) {
            return;
          }
          const filled = { ...EMPTY_READ };
          if (
            !snap.titleTouched &&
            snap.title.trim().length < 2 &&
            draft.title.trim().length >= 2
          ) {
            setTitle(draft.title);
            filled.title = true;
          }
          if (snap.makes.trim().length === 0 && draft.makes.trim().length > 0) {
            setMakes(draft.makes);
          }
          if (
            snap.ingredients.trim().length === 0 &&
            draft.ingredients.trim().length > 0
          ) {
            setIngredients(draft.ingredients);
            filled.ingredients = true;
          }
          if (snap.steps.trim().length === 0 && draft.steps.trim().length > 0) {
            setSteps(draft.steps);
            filled.steps = true;
          }
          if (snap.story.trim().length === 0 && draft.notes.trim().length > 0) {
            setStory(draft.notes);
            filled.story = true;
          }
          const hasWords = filled.ingredients || filled.steps || filled.story;
          setReadFrom(filled.title || hasWords ? "link" : null);
          setReadFields(filled);
          setExtractNote(
            scanSummary({
              kind: "link",
              photoCount: 1,
              many: 1,
              usedAi: result.usedAi,
              hasWords,
              titleOnly: filled.title && !hasWords,
              partial: hasWords && (!filled.ingredients || !filled.steps),
            }),
          );
        })
        .catch(() => {
          if (!cancelled) {
            setExtractNote(
              "Couldn't read words on this link. You can still save it.",
            );
          }
        });
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [intake, kitchenId, sourceUrl, token]);

  function applyCardToForm(card: DraftCard) {
    setTitle(card.title);
    setMakes(card.makes);
    setIngredients(card.ingredients);
    setSteps(card.steps);
    setStory(card.notes);
    setSourceKind(card.sourceKind);
    setSourceTitle(card.sourceTitle);
  }

  function formToDraft(keep: boolean): DraftCard {
    return {
      title,
      makes,
      ingredients,
      steps,
      notes: story,
      sourceKind,
      sourceTitle,
      keep,
    };
  }

  function draftsFromExtract(
    cards: Array<{
      title: string;
      makes: string;
      ingredients: string[];
      steps: string[];
      notes?: string;
      sourceKind: SourceKind;
      sourceTitle: string;
    }>,
  ): DraftCard[] {
    return cards.map((card) => ({
      title: card.title,
      makes: card.makes,
      ingredients: card.ingredients.join("\n"),
      steps: card.steps.join("\n"),
      notes: card.notes?.trim() ?? "",
      sourceKind: card.sourceKind,
      sourceTitle: card.sourceTitle,
      keep: true,
    }));
  }

  function finishScan(input: {
    cards: Array<{
      title: string;
      makes: string;
      ingredients: string[];
      steps: string[];
      notes?: string;
      sourceKind: SourceKind;
      sourceTitle: string;
    }>;
    usedAi: boolean;
    kind: ScanKind;
    fileName: string;
    photoCount: number;
  }) {
    const drafts = draftsFromExtract(input.cards);
    const scanned = drafts[0];
    const fallback = input.kind === "link" ? "" : titleFromFileName(input.fileName);
    const card: DraftCard = scanned
      ? {
          ...scanned,
          title:
            scanned.title.trim().length >= 2 ? scanned.title : fallback || scanned.title,
        }
      : {
          title: fallback,
          makes: "",
          ingredients: "",
          steps: "",
          notes: "",
          sourceKind: "original",
          sourceTitle: "",
          keep: true,
        };
    const pileCards = scanned
      ? drafts.map((draft, index) => (index === 0 ? card : draft))
      : [card];
    setPile(pileCards);
    setEditingIndex(null);
    applyCardToForm(card);
    const ingredientCount = linesFromText(card.ingredients).length;
    const stepCount = linesFromText(card.steps).length;
    const hasNotes = card.notes.trim().length > 0;
    const hasWords = ingredientCount > 0 || stepCount > 0 || hasNotes;
    const filenameTitle = titleFromFileName(input.fileName);
    const titleIsOnlyTheFile =
      !input.usedAi &&
      !hasWords &&
      filenameTitle.length > 0 &&
      scanned !== undefined &&
      scanned.title.trim().toLowerCase() === filenameTitle.toLowerCase();
    const titleFromScan = Boolean(
      scanned && scanned.title.trim().length >= 2 && !titleIsOnlyTheFile,
    );
    setReadFrom(titleFromScan || hasWords ? input.kind : null);
    setReadFields({
      title: titleFromScan,
      ingredients: Boolean(scanned) && ingredientCount > 0,
      steps: Boolean(scanned) && stepCount > 0,
      story: Boolean(scanned) && hasNotes,
    });
    setExtractNote(
      scanSummary({
        kind: input.kind,
        photoCount: input.photoCount,
        many: scanned ? drafts.length : 1,
        usedAi: input.usedAi,
        hasWords,
        titleOnly: input.usedAi && titleFromScan && !hasWords,
        partial:
          input.usedAi &&
          hasWords &&
          (ingredientCount === 0 || stepCount === 0),
      }),
    );
    setScreen(scanned && drafts.length > 1 ? "tray" : "card");
  }

  async function ingestMultiplePhotos(files: File[]) {
    setError(null);
    setExtracting(true);
    setExtractNote(
      `Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`,
    );
    setIntake("photo");
    setSourceKind("original");

    const uploadedIds: Id<"_storage">[] = [];
    let shots: IntakeShot[] = [];

    try {
      const prepared: File[] = [];
      for (const file of files) {
        prepared.push(await downscalePhoto(file));
      }
      for (const [index, file] of prepared.entries()) {
        setExtractNote(`Uploading photo ${index + 1} of ${prepared.length}…`);

        const uploadUrl = await generateUploadUrl(writeAccess);
        const uploaded = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": uploadContentType(file) },
          body: file,
        });

        if (!uploaded.ok) {
          throw new Error(`Photo ${index + 1} didn't upload. Try again.`);
        }

        const { storageId } = (await uploaded.json()) as {
          storageId: Id<"_storage">;
        };
        uploadedIds.push(storageId);
      }

      shots = prepared.map((file, index) => ({
        storageId: uploadedIds[index]!,
        previewUrl: URL.createObjectURL(file),
      }));
      setIntakeShots((current) => {
        for (const shot of current) {
          if (shot.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(shot.previewUrl);
          }
        }
        return shots;
      });
      setCoverPick(null);

      setOriginIsImage(true);
      setOriginPreview((current) => {
        if (
          current?.startsWith("blob:") &&
          !shots.some((shot) => shot.previewUrl === current)
        ) {
          URL.revokeObjectURL(current);
        }
        return shots[0]!.previewUrl;
      });
      setOriginStorageId(shots[0]!.storageId);

      setExtractNote(
        prepared.length > 1 ? "Reading the photos…" : "Reading the photo…",
      );
      let cards: Parameters<typeof finishScan>[0]["cards"] = [];
      let usedAi = false;
      try {
        const extracted = await extractCard({
          ...writeAccess,
          storageId: uploadedIds[0]!,
          fileName: prepared[0]!.name,
          mimeType: uploadContentType(prepared[0]!),
          images: prepared.map((file, index) => ({
            storageId: uploadedIds[index]!,
            fileName: file.name,
            mimeType: uploadContentType(file),
          })),
        });
        cards = extracted.cards;
        usedAi = extracted.usedAi;
      } catch (caught) {
        console.error(caught);
      }
      finishScan({
        cards,
        usedAi,
        kind: "photo",
        fileName: prepared[0]!.name,
        photoCount: prepared.length,
      });
    } catch (caught) {
      setError(messageFrom(caught, "Couldn't upload the photos."));
      for (const shot of shots) {
        if (shot.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(shot.previewUrl);
        }
      }
      setIntakeShots([]);
      setCoverPick(null);
      setOriginPreview(null);
      setOriginIsImage(false);
      setOriginStorageId(null);
    } finally {
      setExtracting(false);
    }
  }

  async function ingestFile(file: File, nextIntake: Intake) {
    setError(null);
    setExtracting(true);
    setExtractNote("Reading the file…");
    setIntake(nextIntake);
    setSourceKind("original");
    const prepared = uploadContentType(file).startsWith("image/")
      ? await downscalePhoto(file)
      : file;
    const contentType = uploadContentType(prepared);
    const isImage = contentType.startsWith("image/");
    setOriginIsImage(isImage);
    if (isImage) {
      setOriginPreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return URL.createObjectURL(prepared);
      });
    } else {
      setOriginPreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    }
    try {
      const uploadUrl = await generateUploadUrl(writeAccess);
      const uploaded = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: prepared,
      });
      if (!uploaded.ok) {
        throw new Error("That file didn't upload. Try one more time.");
      }
      const { storageId } = (await uploaded.json()) as {
        storageId: Id<"_storage">;
      };
      setOriginStorageId(storageId);
      setExtractNote(isImage ? "Reading the photo…" : "Reading the file…");
      let cards: Parameters<typeof finishScan>[0]["cards"] = [];
      let usedAi = false;
      try {
        const extracted = await extractCard({
          ...writeAccess,
          storageId,
          fileName: prepared.name,
          mimeType: contentType,
        });
        cards = extracted.cards;
        usedAi = extracted.usedAi;
      } catch (caught) {
        console.error(caught);
      }
      finishScan({
        cards,
        usedAi,
        kind: isImage ? "photo" : "file",
        fileName: prepared.name,
        photoCount: isImage ? 1 : 0,
      });
    } catch (caught) {
      setError(messageFrom(caught, "Couldn't read that file."));
    } finally {
      setExtracting(false);
    }
  }

  function start(next: Intake) {
    setError(null);
    setIntake(next);
    if (next === "link") {
      setSourceKind("original");
      setScreen("card");
      return;
    }
    if (next === "type") {
      setSourceKind("original");
      setScreen("card");
      return;
    }
    fileInput.current?.click();
  }

  function addChange(move: string) {
    changeSerial.current += 1;
    const id = `change-${changeSerial.current}`;
    setChanges((current) => [...current, { id, move, change: "", why: "" }]);
    window.setTimeout(() => {
      document.getElementById(id)?.focus();
    }, 0);
  }

  function clearDesk() {
    const seen = new Set<string>();
    for (const shot of intakeShots) {
      if (shot.previewUrl.startsWith("blob:") && !seen.has(shot.previewUrl)) {
        URL.revokeObjectURL(shot.previewUrl);
        seen.add(shot.previewUrl);
      }
    }
    if (originPreview?.startsWith("blob:") && !seen.has(originPreview)) {
      URL.revokeObjectURL(originPreview);
    }
    setScreen("choose");
    setIntake("type");
    setSourceKind("original");
    setTitle("");
    setSourceTitle("");
    setSourceUrl("");
    setTitleTouched(false);
    setLookupState("idle");
    setExtractNote(null);
    setReadFrom(null);
    setReadFields(EMPTY_READ);
    setStory("");
    setBakedOn(new Date().toISOString().slice(0, 10));
    setShowDate(false);
    setChanges([]);
    setMakes("");
    setIngredients("");
    setSteps("");
    setOriginStorageId(null);
    setOriginIsImage(false);
    setOriginPreview(null);
    setPhotoFile(null);
    setIntakeShots([]);
    setCoverPick(null);
    setPile([]);
    setEditingIndex(null);
    setEditingBakeId(null);
    setEditingSlug(null);
    setCoverCleared(false);
    hydratedEdit.current = null;
    setError(null);
    if (params.has("edit")) {
      const next = new URLSearchParams(params);
      next.delete("edit");
      setParams(next, { replace: true });
    }
  }

  function finishPublished(slug?: string) {
    allowLeave.current = true;
    clearDesk();
    onPublished?.();
    if (slug) {
      navigate(`/bakes/${slug}`);
    } else {
      navigate("/");
    }
  }

  function startOver() {
    if (editingBakeId && editingSlug) {
      allowLeave.current = true;
      clearDesk();
      onPublished?.();
      navigate(`/bakes/${editingSlug}`);
      return;
    }
    const dirty =
      title.trim().length > 0 ||
      ingredients.trim().length > 0 ||
      pile.length > 0 ||
      originStorageId !== null;
    if (dirty) {
      setStartOverOpen(true);
      return;
    }
    clearDesk();
    onPublished?.();
  }

  function discardAndLeave() {
    setLeaveOpen(false);
    allowLeave.current = true;
    clearDesk();
    onPublished?.();
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }

  function stayOnDesk() {
    setLeaveOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }

  function openDraft(index: number) {
    const draft = pile[index];
    if (!draft) {
      return;
    }
    applyCardToForm(draft);
    setEditingIndex(index);
    setError(null);
    setScreen("card");
  }

  function returnToPile() {
    setPile((current) =>
      current.map((draft, index) =>
        index === editingIndex ? formToDraft(draft.keep) : draft,
      ),
    );
    setEditingIndex(null);
    setError(null);
    setScreen("tray");
  }

  function toggleKeep(index: number) {
    setPile((current) =>
      current.map((draft, i) =>
        i === index ? { ...draft, keep: !draft.keep } : draft,
      ),
    );
  }

  async function addKeptCards() {
    const kept = pile.filter(
      (draft) =>
        draft.keep && draft.title.trim().length >= 2,
    );
    if (kept.length === 0) {
      setError("Keep at least one card with a name.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      let lastSlug: string | null = null;
      for (const draft of kept) {
        const result = await saveBake({
          ...writeAccess,
          title: draft.title,
          story: draft.notes,
          sourceTitle: draft.sourceTitle,
          sourceUrl: "",
          sourceKind: draft.sourceKind,
          bakerName,
          kind: trayFor(draft.title, draft.sourceTitle),
          makes: draft.makes,
          ingredients: linesFromText(draft.ingredients),
          steps: linesFromText(draft.steps),
          originStorageId: originStorageId ?? undefined,
          bakedOn,
          outcome: "",
          changes: [],
          status: "published",
        });
        lastSlug = result.slug;
      }
      if (kept.length === 1 && lastSlug) {
        toast.success("Recipe added to the book.");
        finishPublished(lastSlug);
        return;
      }
      toast.success(`${kept.length} recipes added to the book.`);
      finishPublished();
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not put those in the book.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(status: "draft" | "published") {
    setError(null);
    if (status === "published") {
      if (title.trim().length < 2) {
        setError("Give it a name so you can find it later.");
        document.getElementById("bake-title")?.focus();
        return;
      }
      if (sourceKind === "sally" && !isSallyUrl(sourceUrl)) {
        setError("Paste Sally's link so the credit stays with her.");
        document.getElementById("sourceUrl")?.focus();
        return;
      }
    }
    setPending(true);
    try {
      const tray = photoFile;
      const multi = intakeShots.length > 1;
      const chosen =
        multi && coverPick !== null ? intakeShots[coverPick] : undefined;
      const coverFromCard =
        !multi && originIsImage && originStorageId && !coverCleared
          ? originStorageId
          : null;
      const coverStorageId =
        !multi && tray
          ? await uploadFile(tray)
          : chosen
            ? chosen.storageId
            : (coverFromCard ?? undefined);

      if (editingBakeId) {
        const result = await updateBake({
          bakeId: editingBakeId,
          title,
          story,
          sourceTitle,
          sourceUrl:
            sourceKind === "sally" ? normalizeSallyUrl(sourceUrl) : sourceUrl,
          sourceKind,
          kind: trayFor(title, sourceTitle),
          makes,
          ingredients: linesFromText(ingredients),
          steps: linesFromText(steps),
          coverStorageId: tray ? coverStorageId : undefined,
          clearCover: coverCleared && !tray,
          bakedOn,
          outcome: "",
          changes: readyChanges(changes),
          status,
        });
        if (tray && coverStorageId) {
          try {
            await attachPhoto({
              ...writeAccess,
              bakeId: result.bakeId,
              storageId: coverStorageId,
              alt: title,
            });
          } catch {
            toast.error("Saved, but the photo didn’t attach. You can add it when you edit.");
          }
        }
        const slug = result.slug;
        toast.success(status === "published" ? "Changes saved." : "Draft saved.");
        if (status === "published") {
          finishPublished(slug);
        } else {
          allowLeave.current = true;
          clearDesk();
          onPublished?.();
          navigate(`/bakes/${slug}`);
        }
        return;
      }

      const result = await saveBake({
        ...writeAccess,
        title,
        story,
        sourceTitle,
        sourceUrl: sourceKind === "sally" ? normalizeSallyUrl(sourceUrl) : sourceUrl,
        sourceKind,
        bakerName,
        kind: trayFor(title, sourceTitle),
        makes,
        ingredients: linesFromText(ingredients),
        steps: linesFromText(steps),
        originStorageId: originStorageId ?? undefined,
        coverStorageId,
        bakedOn,
        outcome: "",
        changes: readyChanges(changes),
        status,
      });      
      if (intakeShots.length > 0) {
        try {
          for (const [index, shot] of intakeShots.entries()) {
            const isCover = multi && coverPick === index;
            await attachPhoto({
              ...writeAccess,
              bakeId: result.bakeId,
              storageId: shot.storageId,
              alt: isCover ? title : `${title} - Photo ${index + 1}`,
              setCover: isCover,
              leaveUncovered: multi,
            });
          }
          for (const shot of intakeShots) {
            if (shot.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(shot.previewUrl);
            }
          }
          setIntakeShots([]);
          setCoverPick(null);
          setOriginPreview(null);
          setOriginIsImage(false);
        } catch {
          toast.error("Saved, but some photos didn't attach. You can add them when you edit.");
        }
      } else if (coverStorageId) {
        // Single photo from tray or origin
        try {
          await attachPhoto({
            ...writeAccess,
            bakeId: result.bakeId,
            storageId: coverStorageId,
            alt: title,
          });
        } catch {
          toast.error("Saved, but the photo didn't attach. You can add it when you edit.");
        }
      }
      if (status === "published" && pile.length > 1 && editingIndex !== null) {
        const remaining = pile.filter((_, index) => index !== editingIndex);
        setPile(remaining);
        setEditingIndex(null);
        if (remaining.length === 0) {
          toast.success("Recipe added to the book.");
          finishPublished(result.slug);
          return;
        }
        toast.success("That one is in the book.");
        setScreen("tray");
        return;
      }
      if (status === "published") {
        toast.success("Recipe added to the book.");
        finishPublished(result.slug);
      } else {
        toast.success("Draft saved. You can come back later.");
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  async function uploadFile(file: File): Promise<Id<"_storage">> {
    const uploadUrl = await generateUploadUrl(writeAccess);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": uploadContentType(file) },
      body: file,
    });
    if (!response.ok) {
      throw new Error("The photo didn't upload. Try one more time.");
    }
    const { storageId } = (await response.json()) as {
      storageId: Id<"_storage">;
    };
    return storageId;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void onSubmit("published");
  }

  return (
    <div className="write-desk">
      <PageTitle
        title={`${editingBakeId ? "Edit recipe" : "Add a recipe"} · ${SITE_SHORT}`}
      />
      <input
        ref={fileInput}
        id={fileId}
        type="file"
        accept={
          intake === "photo"
            ? "image/*"
            : "image/*,.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
        }
        multiple={intake === "photo"}
        aria-label={
          intake === "photo" ? "Recipe photos" : "Recipe file"
        }
        className="sr-only"
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (picked.length === 0) {
            setError("No photo came through. Try choosing it again.");
            return;
          }
          if (intake === "photo") {
            const photos = photosFromPicker(picked);
            if (photos.length === 0) {
              setError(
                "Those aren't photos. Choose a picture from your camera roll.",
              );
              return;
            }
            if (photos.length > 1) {
              void ingestMultiplePhotos(photos);
              return;
            }
            const only = photos[0];
            if (only) {
              void ingestFile(only, "photo");
            }
            return;
          }
          const file = picked[0];
          if (file) {
            void ingestFile(file, intake === "file" ? "file" : "photo");
          }
        }}
      />

      {editBakeId && editBake === undefined ? (
        <p role="status" className="mt-6 text-[18px] text-ink-soft">
          Opening that recipe…
        </p>
      ) : screen === "choose" ? (
        <div>
          <p className="mt-1 text-[19px] leading-8 text-ink-soft">
            Put it in the book however you already have it. A picture of a
            recipe is enough. A whole PowerPoint of recipes is fine too — you’ll
            see the pile before anything goes in.
          </p>
          {error ? (
            <p role="alert" className="mt-6 text-[17px] text-cinnamon-deep">
              {error}
            </p>
          ) : null}
          {extracting ? (
            <p role="status" className="mt-8 text-[18px] text-ink-soft">
              {extractNote ??
                "Reading the file. If there are a lot of recipes, this can take a minute."}
            </p>
          ) : (
            <div className="mt-8 flex flex-col items-start gap-3">
              <button
                type="button"
                className="book-press book-press-text book-press-save"
                onClick={() => {
                  setIntake("photo");
                  window.setTimeout(() => fileInput.current?.click(), 0);
                }}
              >
                Take or choose photos
              </button>
              <button
                type="button"
                className="book-press book-press-text"
                onClick={() => {
                  setIntake("file");
                  window.setTimeout(() => fileInput.current?.click(), 0);
                }}
              >
                Upload a PDF or PowerPoint
              </button>
              <button
                type="button"
                className="book-press book-press-text"
                onClick={() => start("link")}
              >
                Paste a link — Sally, TikTok, Pinterest
              </button>
              <button
                type="button"
                className="min-h-12 cursor-pointer text-[17px] text-ink-soft underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                onClick={() => start("type")}
              >
                Type it myself
              </button>
            </div>
          )}
        </div>
      ) : screen === "tray" ? (
        <div className="mt-3">
          <button
            type="button"
            className="book-press book-press-text self-start"
            onClick={startOver}
          >
            Add a different way
          </button>
          <h1 className="font-display mt-2 text-[2.15rem] leading-[1.12] tracking-tight md:text-[2.6rem]">
            These recipes
          </h1>
          <p className="mt-3 text-[19px] leading-8 text-ink-soft">
            {extractNote ??
              "Leave out any you don’t want. Open one to fix the words. Then put the rest in the book."}
          </p>
          <ul className="mt-8 flex flex-col">
            {pile.map((draft, index) => {
              const ings = linesFromText(draft.ingredients);
              const preview = ings.slice(0, 3).join(" · ");
              return (
                <li
                  key={`${draft.title}-${index}`}
                  className="border-t border-rule py-5"
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={draft.keep}
                      aria-label={
                        draft.keep
                          ? `Keep ${draft.title || "this card"}`
                          : `Leave out ${draft.title || "this card"}`
                      }
                      onClick={() => toggleKeep(index)}
                      className={[
                        "mt-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-[1.5px]",
                        draft.keep
                          ? "border-cinnamon-deep bg-paper-raised text-cinnamon-deep"
                          : "border-cocoa bg-transparent text-transparent",
                      ].join(" ")}
                    >
                      <span aria-hidden className="font-display text-[1.4rem] leading-none">
                        ✓
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          "font-display text-[1.45rem] leading-8",
                          draft.keep ? "text-ink" : "text-ink-soft line-through",
                        ].join(" ")}
                      >
                        {draft.title.trim() || "Untitled card"}
                      </p>
                      <p className="mt-1 text-[16px] leading-7 text-ink-soft">
                        {draft.makes.trim()
                          ? `${draft.makes} · `
                          : ""}
                        {ings.length === 1
                          ? "1 ingredient"
                          : `${ings.length} ingredients`}
                        {preview ? ` — ${preview}` : ""}
                      </p>
                      <button
                        type="button"
                        className="mt-2 min-h-12 cursor-pointer text-[17px] underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                        onClick={() => openDraft(index)}
                      >
                        Open and fix
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {error ? (
            <p
              id={formErrorId}
              role="alert"
              className="mt-6 text-[17px] text-cinnamon-deep"
            >
              {error}
            </p>
          ) : null}
          <div className="sticky bottom-0 z-10 mt-8 -mx-2 border-t border-rule bg-paper px-2 py-3">
            <button
              type="button"
              className="book-press book-press-text book-press-save w-full"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void addKeptCards()}
            >
              {pending
                ? "Putting them in the book…"
                : pile.filter((draft) => draft.keep).length === 1
                  ? "Put this one in the book"
                  : `Put ${pile.filter((draft) => draft.keep).length} in the book`}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="write-desk-leaf mt-3 flex flex-col"
          noValidate
          onSubmit={handleSubmit}
          aria-describedby={error ? formErrorId : undefined}
        >
          <button
            type="button"
            className="self-start min-h-12 cursor-pointer text-[17px] text-ink-soft underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
            onClick={pile.length > 1 ? returnToPile : startOver}
          >
            {editingBakeId
              ? "Cancel"
              : pile.length > 1
                ? "Back to the pile"
                : "Add a different way"}
          </button>
          {extractNote ? (
            <p role="status" className="mt-3 text-[18px] leading-7 text-ink-soft">
              {extractNote}
            </p>
          ) : null}

          {/* Same rhythm as the bake page: photo + title/story, then the recipe card. */}
          <header className="bake-leaf-hero write-desk-hero">
            <div className="bake-leaf-hero-photo write-desk-hero-photo">
              {intakeShots.length > 1 ? (
                <CoverChoices
                  shots={intakeShots}
                  coverPick={coverPick}
                  onPick={(index) =>
                    setCoverPick((current) => (current === index ? null : index))
                  }
                />
              ) : originPreview || photoPreview ? (
                <div className="write-desk-photo">
                  <img
                    src={photoPreview ?? originPreview ?? ""}
                    alt={
                      title.trim()
                        ? title.trim()
                        : "Recipe photo"
                    }
                    className="write-desk-photo-img"
                  />
                  <button
                    type="button"
                    className="mt-2 min-h-12 cursor-pointer text-[17px] underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                    onClick={() => {
                      setOriginStorageId(null);
                      setOriginIsImage(false);
                      setCoverCleared(true);
                      setOriginPreview((current) => {
                        if (current?.startsWith("blob:")) {
                          URL.revokeObjectURL(current);
                        }
                        return null;
                      });
                      setPhotoFile(null);
                    }}
                  >
                    Remove this picture
                  </button>
                </div>
              ) : (
                <label
                  htmlFor={photoId}
                  className="write-desk-photo-empty"
                >
                  <span className="text-[17px] leading-7 text-ink-soft">
                    Tap to add a photo
                  </span>
                  <input
                    id={photoId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      setCoverCleared(false);
                      setPhotoFile(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="bake-leaf-hero-copy">
              <Kicker>
                {editingBakeId ? "Editing" : "New card"}
                {" · "}
                {bakerName}
                {" · "}
                {showDate ? (
                  <label htmlFor="bakedOn" className="inline">
                    <span className="sr-only">When</span>
                    <input
                      id="bakedOn"
                      type="date"
                      value={bakedOn}
                      onChange={(event) => setBakedOn(event.target.value)}
                      className="write-desk-date"
                    />
                  </label>
                ) : (
                  <>
                    <time dateTime={bakedOn}>{formatBakeDate(bakedOn)}</time>
                    {" · "}
                    <button
                      type="button"
                      className="cursor-pointer underline decoration-rule underline-offset-4 hover:text-cocoa"
                      onClick={() => setShowDate(true)}
                    >
                      Change date
                    </button>
                  </>
                )}
              </Kicker>

              <Label htmlFor="bake-title" className="sr-only">
                What do you call it?
              </Label>
              <input
                id="bake-title"
                value={title}
                onChange={(event) => {
                  setTitleTouched(true);
                  setTitle(event.target.value);
                }}
                placeholder="What do you call it?"
                required
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="next"
                className="bake-leaf-title write-desk-title"
              />
              <ReadFromLine from={readFrom} show={readFields.title} />

              <div>
                <p className="text-[16px] font-medium leading-6 text-ink-soft">
                  Where did this come from?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SOURCE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={sourceKind === kind}
                      onClick={() => setSourceKind(kind)}
                      className={[
                        "inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border-[1.5px] px-3 text-[16px]",
                        sourceKind === kind
                          ? "border-cinnamon-deep bg-paper-raised text-cinnamon-deep"
                          : "border-cocoa/55 bg-transparent text-ink hover:border-cinnamon-deep",
                      ].join(" ")}
                    >
                      {SOURCE_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>

              {sourceLink(sourceKind) || intake === "link" ? (
                <div>
                  <Label htmlFor="sourceUrl">
                    {sourceLink(sourceKind)?.label ?? "The link"}
                  </Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    inputMode="url"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    onBlur={(event) =>
                      setSourceUrl(
                        sourceKind === "sally"
                          ? normalizeSallyUrl(event.target.value)
                          : event.target.value.trim(),
                      )
                    }
                    placeholder={
                      sourceLink(sourceKind)?.placeholder ?? "https://…"
                    }
                    className="mt-2 min-h-12"
                  />
                  {lookupState === "looking" ? (
                    <p role="status" className="mt-2 text-[17px] text-ink-soft">
                      Looking up what she calls it…
                    </p>
                  ) : null}
                  {lookupState === "found" && sourceTitle ? (
                    <p className="mt-2 text-[17px] text-ink-soft">
                      Sally calls this{" "}
                      <span className="text-ink">{sourceTitle}</span>.
                    </p>
                  ) : null}
                  {lookupState === "miss" ? (
                    <p role="status" className="mt-2 text-[17px] text-ink-soft">
                      Couldn't find a title on that link. Name it yourself.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {sourceNote(sourceKind) ? (
                <div>
                  <Label htmlFor="sourceTitle">
                    {sourceNote(sourceKind)?.label}
                  </Label>
                  <Input
                    id="sourceTitle"
                    value={sourceTitle}
                    onChange={(event) => setSourceTitle(event.target.value)}
                    placeholder={sourceNote(sourceKind)?.placeholder}
                    className="mt-2 min-h-12"
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="story">How it went</Label>
                <Textarea
                  id="story"
                  value={story}
                  onChange={(event) => setStory(event.target.value)}
                  placeholder="Always a hit! Sunday morning…"
                  className="mt-2 min-h-28 w-full"
                />
                <ReadFromLine from={readFrom} show={readFields.story} />
              </div>
            </div>
          </header>

          <section
            aria-labelledby="write-method-heading"
            className="kitchen-method write-desk-method mt-8 w-full rounded-lg border border-rule border-l-[3px] border-l-cinnamon bg-paper-raised px-3.5 py-5 md:px-7 md:py-7"
          >
            <Kicker>The recipe</Kicker>
            <h2
              id="write-method-heading"
              className="font-display mt-1 text-[1.65rem] leading-8"
            >
              How we made it
            </h2>

            <Label htmlFor="makes" className="mt-4">
              How much it made
            </Label>
            <Input
              id="makes"
              value={makes}
              onChange={(event) => setMakes(event.target.value)}
              placeholder={MAKES_HINT[trayFor(title, sourceTitle)]}
              className="mt-2 min-h-12 w-full"
            />

            <div className="write-desk-recipe-cols mt-6">
              <div>
                <Label
                  htmlFor="ingredients"
                  className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep"
                >
                  What went in
                </Label>
                <p className="mt-1 text-[15px] leading-6 text-ink-soft">
                  One per line — so you can search later. Leave this blank if the photo is enough.
                </p>
                <ReadFromLine from={readFrom} show={readFields.ingredients} />
                <Textarea
                  id="ingredients"
                  value={ingredients}
                  onChange={(event) => setIngredients(event.target.value)}
                  placeholder={
                    "3–6 bell peppers\nwhite rice\nblack beans\ntomatoes"
                  }
                  className="mt-3 min-h-52 w-full"
                />
              </div>
              <div>
                <Label
                  htmlFor="steps"
                  className="text-[17px] font-medium tracking-[0.02em] text-cinnamon-deep"
                >
                  How
                </Label>
                <p className="mt-1 text-[15px] leading-6 text-ink-soft">
                  One step per line. Leave this blank if you don't have them yet.
                </p>
                <ReadFromLine from={readFrom} show={readFields.steps} />
                <Textarea
                  id="steps"
                  value={steps}
                  onChange={(event) => setSteps(event.target.value)}
                  placeholder={
                    "Preheat oven to 400.\nCook the rice.\nStuff and bake."
                  }
                  className="mt-3 min-h-52 w-full"
                />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="write-sauce-heading"
            className="secret-sauce write-desk-sauce mt-6 w-full rounded-lg border border-rule border-l-[3px] border-l-cinnamon bg-paper-raised px-5 py-5"
          >
            <Kicker>The secret sauce</Kicker>
            <h2
              id="write-sauce-heading"
              className="font-display mt-1 text-[1.65rem] leading-8"
            >
              What I changed
            </h2>
            <p className="mt-3 text-[17px] leading-7 text-ink-soft">
              Optional. Tap what you did, then say what — butter, flour,
              whatever.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CHANGE_MOVES.map((move) => (
                <button
                  key={move}
                  type="button"
                  onClick={() => addChange(move)}
                  className="inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-[2px] border-[1.5px] border-cocoa/55 bg-transparent px-3 text-[16px] text-ink hover:border-cinnamon-deep"
                >
                  {move}
                </button>
              ))}
            </div>
            {changes.length > 0 ? (
              <ul className="mt-5 flex flex-col">
                {changes.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-end gap-2 border-t border-rule/80 py-3 first:border-t-0 first:pt-0 last:pb-0"
                  >
                    <p className="min-w-[5.5rem] pb-3 text-[15px] font-medium uppercase tracking-[0.06em] text-cinnamon-deep">
                      {row.move}
                    </p>
                    <Input
                      id={row.id}
                      value={row.change}
                      onChange={(event) => {
                        const next = event.target.value;
                        setChanges((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, change: next }
                              : item,
                          ),
                        );
                      }}
                      placeholder={changeHint(row.move)}
                      aria-label={`${row.move} what`}
                      className="min-h-12 min-w-[10rem] flex-1"
                    />
                    <button
                      type="button"
                      className="min-h-12 cursor-pointer text-[17px] underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                      onClick={() =>
                        setChanges((current) =>
                          current.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      Take off
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {error ? (
            <p
              id={formErrorId}
              role="alert"
              className="mt-6 text-[17px] text-cinnamon-deep"
            >
              {error}
            </p>
          ) : null}
          <div className="sticky bottom-0 z-10 mt-8 -mx-2 border-t border-rule bg-paper px-2 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                className="book-press book-press-text book-press-save"
                disabled={pending || extracting}
                aria-busy={pending}
              >
                {pending
                  ? editingBakeId
                    ? "Saving…"
                    : "Putting it in the book…"
                  : editingBakeId
                    ? "Save changes"
                    : "Put it in the book"}
              </button>
              {editingBakeId ? null : (
                <button
                  type="button"
                  className="book-press book-press-text"
                  disabled={pending}
                  onClick={() => void onSubmit("draft")}
                >
                  Save for later
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {screen === "tray" && editingBakeId && editPhotos !== undefined ? (
        <PhotoManager
          bakeId={editingBakeId}
          photos={editPhotos}
          coverStorageId={editBake?.coverStorageId}
          writerToken={token}
          kitchenId={kitchenId}
          onPhotosChange={() => {
            // Photos will refresh via Convex reactivity
          }}
        />
      ) : null}

      {screen === "choose" && mine && mine.length > 0 ? (
        <details className="mt-16 border-t border-rule pt-6">
          <summary className="flex min-h-11 cursor-pointer items-center text-[17px] text-ink-soft underline decoration-rule underline-offset-4 hover:text-cinnamon-deep">
            Already in the book
            {mine.length === 1 ? " · 1 bake" : ` · ${mine.length} bakes`}
          </summary>
          <ul className="mt-4">
            {mine.map((bake) => (
              <li key={bake._id} className="border-t border-rule py-4">
                {bake.status === "published" ? (
                  <Link
                    to={`/bakes/${bake.slug}`}
                    className="font-display h-auto min-h-14 px-0 text-[1.35rem] block text-ink no-underline hover:text-cinnamon-deep"
                  >
                    {bake.title}
                  </Link>
                ) : (
                  <p className="font-display text-[1.35rem] text-ink-soft">
                    {bake.title}
                    <span className="ml-2 text-[17px] font-sans italic">
                      Saved for later
                    </span>
                  </p>
                )}
                <p className="text-[16px] text-ink-soft">
                  {bake.status === "draft"
                    ? "Not in the book yet"
                    : formatBakeDate(bake.bakedOn)}
                </p>
                <p className="mt-2">
                  <Link
                    to={`${DESK_PATH}?edit=${bake._id}`}
                    className="inline-flex min-h-12 items-center text-[17px] underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
                  >
                    Edit
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {screen === "choose" && onLock ? (
        <button
          type="button"
          className="mt-10 min-h-12 cursor-pointer text-[17px] text-ink-soft underline decoration-rule underline-offset-4 hover:text-cinnamon-deep"
          onClick={() => setLockOpen(true)}
        >
          Lock the kitchen
        </button>
      ) : null}

      <BookConfirm
        open={leaveOpen}
        title={leaveTitle}
        body={leaveBody}
        confirmLabel="Discard"
        cancelLabel="Keep working"
        danger
        onConfirm={discardAndLeave}
        onCancel={stayOnDesk}
      />
      <BookConfirm
        open={startOverOpen}
        title={pile.length > 1 ? "Leave this pile?" : "Start over?"}
        body={
          pile.length > 1
            ? "None of these recipes will be saved."
            : "What you typed here won’t be saved."
        }
        confirmLabel="Discard"
        cancelLabel="Keep working"
        danger
        onConfirm={() => {
          setStartOverOpen(false);
          clearDesk();
          onPublished?.();
        }}
        onCancel={() => setStartOverOpen(false)}
      />
      <BookConfirm
        open={lockOpen}
        title="Lock this device?"
        body="You’ll need the kitchen code again to write."
        confirmLabel="Lock"
        cancelLabel="Stay unlocked"
        danger
        onConfirm={() => {
          setLockOpen(false);
          void onLock?.();
        }}
        onCancel={() => setLockOpen(false)}
      />
    </div>
  );
}
