import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { SiteFooter } from "@/components/SiteFooter";
import { PageTitle } from "@/lib/pageTitle";
import { markOAuthReturn, stashInvite } from "@/lib/oauthReturn";
import { SITE_NAME, SITE_SHORT } from "@/lib/site";
import { useToast } from "@/lib/toast";

function GoogleComeIn({
  cover = false,
  inviteToken,
}: {
  cover?: boolean;
  inviteToken?: string;
}) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function handleGoogle() {
    setPending(true);
    try {
      if (inviteToken) {
        stashInvite(inviteToken);
      } else {
        const fromUrl = new URLSearchParams(window.location.search)
          .get("invite")
          ?.trim();
        if (fromUrl) {
          stashInvite(fromUrl);
        }
      }
      markOAuthReturn();
      await signIn("google", { redirectTo: window.location.href });
    } catch {
      toast.error("Google didn’t open. Try once more.");
      setPending(false);
    }
  }

  return (
    <>
      <div className={cover ? "book-cover-cta-wrap" : "mt-8"}>
        <button
          type="button"
          className={
            cover
              ? "book-cover-cta"
              : "book-press book-press-text book-press-save w-full"
          }
          disabled={pending}
          aria-busy={pending}
          onClick={() => void handleGoogle()}
        >
          Continue with Google
        </button>
      </div>
    </>
  );
}

export function JoinCoverLanding({ invited = false }: { invited?: boolean }) {
  return (
    <div className="book-cover-copy">
      <PageTitle title={SITE_NAME} />
      {invited ? (
        <p className="book-cover-eyebrow">You’ve been invited</p>
      ) : null}
      <h1 className="book-cover-headline">
        <span className="book-cover-title-the">The</span>
        <span>Family</span>
        <span className="book-cover-title-accent">Recipe Book</span>
      </h1>
      {invited ? (
        <p className="book-cover-promise">
          Come cook with us. Sign in and you’ll both show up in each other’s books.
        </p>
      ) : null}
      <p className="book-cover-proof">
        Keep the recipes. Pass them on.
      </p>
      <GoogleComeIn cover />
      <SiteFooter tone="dark" homeLink={false} />
    </div>
  );
}

export function FamilyDoor({
  inviteToken,
  kitchenName,
}: {
  inviteToken?: string;
  kitchenName?: string;
}) {
  const heading = kitchenName ? `${kitchenName}'s recipes` : "Come in";
  const blurb = kitchenName
    ? "You’ll both show up in each other’s books. Use the Google you already have."
    : "Use the Google you already have. Same one as Gmail.";

  return (
    <div className="relative z-10 mt-8 max-w-[28rem] pt-2 md:mt-4">
      <PageTitle title={`${heading} · ${SITE_SHORT}`} />
      {kitchenName ? (
        <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-tight">
          {heading}
        </h1>
      ) : null}
      <p
        className={`${kitchenName ? "mt-4" : ""} text-[19px] leading-8 text-ink-soft`}
      >
        {blurb}
      </p>
      <GoogleComeIn inviteToken={inviteToken} />
      <SiteFooter homeLink={false} />
    </div>
  );
}
