import type { ReactElement, ReactNode } from "react";
import { useSeason } from "@/lib/SeasonTheme";
import type { DoodleName, DoodleSpot } from "@/lib/season";

function DoodleSvg({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Apple({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M32 16c-3-8-10-12-16-10-8 4-11 18-6 28 5 14 20 20 20 20s15-6 20-20c5-10 2-24-6-28-6-2-13 1-16 10Z"
      />
      <path d="M32 16c1-10 7-15 13-16" strokeWidth="2.5" />
      <path d="M32 18c-6 4-11 4-16 2" strokeWidth="2" />
      <path d="M28 14c2-3 6-4 8-3" strokeWidth="1.5" />
      <path d="M36 12c2-3 5-3 7-1" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Leaf({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M14 44c12-28 32-40 48-44-2 20-10 38-32 44-8 2-18 2-16 0Z"
      />
      <path d="M18 42c12-14 26-26 42-32" strokeWidth="2.5" />
      <path d="M20 40c8-10 18-18 30-24" strokeWidth="1.5" />
      <path d="M22 38c6-6 14-12 22-16" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Maple({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 58V38" strokeWidth="2.5" />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M32 16 16 28l8-14L12 8l20 6L32 2l4 12 20-6-12 6 8 14-16-12Z"
      />
      <path d="M32 16c-8 4-14 8-16 12" strokeWidth="1.5" />
      <path d="M32 16c8 4 14 8 16 12" strokeWidth="1.5" />
      <path d="M24 14c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M40 14c4-2 8-2 8 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Squash({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 8c3 6 3 12 0 14" strokeWidth="2.5" />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M18 24c-8 12-7 28 4 36 8 6 22 5 26-4 8-12 5-28-6-36-6-5-16-5-22 4Z"
      />
      <path d="M24 32c3 10 6 18 6 22" strokeWidth="2" />
      <path d="M28 20c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M36 18c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M20 28c6 4 12 4 16 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Corn({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M32 6c10 10 12 36 0 54-12-18-10-44 0-54Z"
      />
      <path d="M26 20c2 1 4 1 6 0M32 20c2 1 4 1 6 0" strokeWidth="2" />
      <path d="M25 28c2 1 5 1 7 0M32 28c2 1 5 1 7 0" strokeWidth="2" />
      <path d="M26 36c2 1 4 1 6 0M32 36c2 1 4 1 6 0" strokeWidth="2" />
      <path d="M25 44c2 1 5 1 7 0M32 44c2 1 5 1 7 0" strokeWidth="2" />
      <path d="M16 18c-6 14-3 28 10 36" strokeWidth="2.5" />
      <path d="M48 18c6 14 3 28-10 36" strokeWidth="2.5" />
      <path d="M30 8c2-2 4-2 4 0" strokeWidth="1.5" />
      <path d="M34 8c2-2 4-2 4 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Tomato({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M14 28c0-12 10-18 18-18s18 6 18 18-8 22-18 22-18-10-18-22Z"
      />
      <path d="M32 12c-5-8-12-8-14-5 5 3 10 5 14 5 5 0 10-3 14-5-2-3-10-3-14 5Z" strokeWidth="2.5" />
      <path d="M28 18c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M36 18c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M24 26c2 0 4 0 4 2" strokeWidth="1.5" />
      <path d="M40 26c2 0 4 0 4 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Rain({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M16 16c0 8 5 14 8 14s8-6 8-14-5-10-8-10-8 2-8 10Z" strokeWidth="2.5" />
      <path d="M36 26c0 8 5 14 8 14s8-6 8-14-5-10-8-10-8 2-8 10Z" strokeWidth="2.5" />
      <path d="M26 40c0 6 4 12 6 12s6-6 6-12-4-8-6-8-6 2-6 8Z" strokeWidth="2.5" />
      <path d="M20 24c2 0 4 0 4 2" strokeWidth="1.5" />
      <path d="M40 34c2 0 4 0 4 2" strokeWidth="1.5" />
      <path d="M30 44c2 0 4 0 4 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Pumpkin({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 14c3 5 3 10 0 12" strokeWidth="2.5" />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M14 32c0-14 10-20 18-20s18 6 18 20-8 20-18 20-18-6-18-20Z"
      />
      <path d="M22 18c-5 8-5 24 0 32" strokeWidth="2.5" />
      <path d="M42 18c5 8 5 24 0 32" strokeWidth="2.5" />
      <path d="M32 14c-4-4-10-4-12-2 5 3 10 4 12 2 2 2 7 3 12 2" strokeWidth="1.5" />
      <path d="M28 24c2 2 4 2 6 0" strokeWidth="1.5" />
      <path d="M38 24c2 2 4 2 6 0" strokeWidth="1.5" />
      <path d="M32 32c2 2 4 2 6 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Pine({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 58V42" strokeWidth="2.5" />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M32 8 14 30h10l-12 12h12l-10 12h32l-10-12h12L40 30h10L32 8Z"
      />
      <path d="M32 8c-10 6-16 14-18 22" strokeWidth="1.5" />
      <path d="M32 8c10 6 16 14 18 22" strokeWidth="1.5" />
      <path d="M28 20c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M36 20c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M24 30c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M40 30c4-2 8-2 8 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Snow({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 8v48M10 32h44M16 16l32 32M48 16l-32 32" strokeWidth="2.5" />
      <path d="M32 16c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M32 48c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M16 32c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M48 32c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M22 22c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M42 22c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M22 42c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M42 42c2 0 4 0 4 2" strokeWidth="2" />
    </DoodleSvg>
  );
}

function Mug({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M14 22h28v24c0 8-8 12-14 12s-14-4-14-12V22Z"
      />
      <path d="M42 26h8c5 0 8 5 8 10s-3 10-8 10h-8" strokeWidth="2.5" />
      <path d="M22 12c0-5 5-8 5-12" strokeWidth="2.5" />
      <path d="M32 12c0-5 5-8 5-12" strokeWidth="2.5" />
      <path d="M26 16c2-2 4-2 4 0" strokeWidth="1.5" />
      <path d="M36 16c2-2 4-2 4 0" strokeWidth="1.5" />
      <path d="M18 30c8-2 16-2 20 0" strokeWidth="1.5" />
      <path d="M18 38c8-2 16-2 20 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Berry({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M22 34a10 10 0 1 1 0.1 0Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M40 28a10 10 0 1 1 0.1 0Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M38 46a9 9 0 1 1 0.1 0Z"
      />
      <path d="M34 20c3 5 8 8 12 8" strokeWidth="2.5" />
      <path d="M26 38c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M44 32c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M42 44c2 0 4 0 4 2" strokeWidth="2" />
    </DoodleSvg>
  );
}

function Strawberry({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M32 16c-12 4-18 18-14 30 5 10 22 10 28 0 5-12-2-24-14-30Z"
      />
      <path d="M20 16c5 2 8 2 12 0 4 2 8 2 12 0-2-8-10-10-12-10s-10 2-12 10Z" strokeWidth="2" />
      <path d="M24 28c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M36 34c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M28 40c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M40 26c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M22 32c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M38 30c2 0 4 0 4 2" strokeWidth="2" />
    </DoodleSvg>
  );
}

function Lilac({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M32 58V32" strokeWidth="2.5" />
      <path fill="currentColor" fillOpacity="0.35" d="M22 20a8 8 0 1 1 0.1 0Z" />
      <path fill="currentColor" fillOpacity="0.35" d="M32 14a8 8 0 1 1 0.1 0Z" />
      <path fill="currentColor" fillOpacity="0.35" d="M42 20a8 8 0 1 1 0.1 0Z" />
      <path fill="currentColor" fillOpacity="0.35" d="M26 28a7 7 0 1 1 0.1 0Z" />
      <path fill="currentColor" fillOpacity="0.35" d="M38 28a7 7 0 1 1 0.1 0Z" />
      <path d="M18 34c8-2 12-2 14 2" strokeWidth="2" />
      <path d="M28 24c2 0 4 0 4 2" strokeWidth="1.5" />
      <path d="M38 18c2 0 4 0 4 2" strokeWidth="1.5" />
      <path d="M32 28c2 0 4 0 4 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Rhubarb({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M22 52c-2-18 0-32 2-40 8-2 10 2 8 10" strokeWidth="2.5" />
      <path d="M38 52c2-20 4-34 10-40 8 0 8 6 2 12" strokeWidth="2.5" />
      <path d="M16 14c8-8 16-8 20-2" strokeWidth="2" />
      <path d="M36 14c8-6 16-4 18 6" strokeWidth="2" />
      <path d="M20 24c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M32 18c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M24 32c4-2 8-2 10 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Robin({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M12 34c8-12 20-16 32-10 8 5 10 14 2 20-10 8-26 5-34-2-2-2-5-5-2-8Z" strokeWidth="2.5" />
      <path d="M42 28c5-2 12-2 14 3" strokeWidth="2" />
      <path d="M16 32c8 2 14 2 18-2" strokeWidth="2" />
      <path d="M20 46l-5 10" strokeWidth="2" />
      <path d="M32 48l3 10" strokeWidth="2" />
      <path d="M24 30c4-2 8-2 10 2" strokeWidth="1.5" />
      <path d="M36 26c4-2 8-2 10 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Wave({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.25"
        d="M4 26c10 10 18 10 28 0s18-10 28 0 10 10 12 10v14c-2 0-2-10-12-10s-18 10-28 0-18 10-28 0V26Z"
      />
      <path d="M4 26c10 10 18 10 28 0s18-10 28 0 10 10 12 10" strokeWidth="2.5" />
      <path d="M4 40c10 10 18 10 28 0s18-10 28 0 10 10 12 10" strokeWidth="2.5" />
      <path d="M12 32c4 0 8 0 10 2" strokeWidth="1.5" />
      <path d="M28 26c4 0 8 0 10 2" strokeWidth="1.5" />
      <path d="M44 32c4 0 8 0 10 2" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Cookie({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M12 30c0-14 12-22 22-20 10 2 18 12 16 24-2 14-16 20-28 16-10-2-12-10-12-20Z"
      />
      <path d="M22 24c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M36 20c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M32 32c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M42 30c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M24 38c2 0 4 0 4 2" strokeWidth="2.5" />
      <path d="M18 28c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M38 24c2 0 4 0 4 2" strokeWidth="2" />
      <path d="M28 36c2 0 4 0 4 2" strokeWidth="2" />
    </DoodleSvg>
  );
}

function Pie({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        d="M10 38c5 12 18 18 32 14 8-2 12-10 10-16L32 16 10 38Z"
      />
      <path d="M12 36c12-4 24-6 36 0" strokeWidth="2.5" />
      <path d="M32 16v12" strokeWidth="2.5" />
      <path d="M32 16c-8 4-14 8-16 14" strokeWidth="1.5" />
      <path d="M32 16c8 4 14 8 16 14" strokeWidth="1.5" />
      <path d="M20 24c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M36 20c4-2 8-2 8 0" strokeWidth="1.5" />
      <path d="M28 28c4-2 8-2 8 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

function Tap({ className }: { className?: string }) {
  return (
    <DoodleSvg className={className}>
      <path d="M16 12h10v22" strokeWidth="2.5" />
      <path d="M22 34c0 10 5 16 5 16" strokeWidth="2.5" />
      <path d="M14 50h24c3 8-3 12-12 12s-15-4-12-12Z" strokeWidth="2.5" />
      <path d="M18 50c3 5 10 5 14 0" strokeWidth="2" />
      <path d="M26 16c2-2 4-2 4 0" strokeWidth="1.5" />
      <path d="M30 14c2-2 4-2 4 0" strokeWidth="1.5" />
    </DoodleSvg>
  );
}

const DOODLES: Record<
  DoodleName,
  (props: { className?: string }) => ReactElement
> = {
  apple: Apple,
  berry: Berry,
  cookie: Cookie,
  corn: Corn,
  leaf: Leaf,
  lilac: Lilac,
  maple: Maple,
  mug: Mug,
  pie: Pie,
  pine: Pine,
  pumpkin: Pumpkin,
  rain: Rain,
  rhubarb: Rhubarb,
  robin: Robin,
  snow: Snow,
  squash: Squash,
  strawberry: Strawberry,
  tap: Tap,
  tomato: Tomato,
  wave: Wave,
};

const TONE_CLASS: Record<DoodleSpot["tone"], string> = {
  action: "season-doodle-action",
  cocoa: "season-doodle-cocoa",
  leaf: "season-doodle-leaf",
  cool: "season-doodle-cool",
};

function Spot({ spot }: { spot: DoodleSpot }) {
  const Graphic = DOODLES[spot.doodle];
  return (
    <div
      className={`season-doodle absolute max-md:[&:nth-child(n+5)]:hidden ${TONE_CLASS[spot.tone]}`}
      style={{
        top: spot.top,
        right: spot.right,
        left: spot.left,
        width: spot.size,
        height: spot.size,
        transform: `rotate(${spot.rotate}deg)`,
      }}
    >
      <Graphic className="h-full w-full" />
    </div>
  );
}

export function SeasonDoodles({
  forceVisible = false,
}: {
  forceVisible?: boolean;
}) {
  const theme = useSeason();
  const visibilityClass = forceVisible ? " season-doodles-visible" : "";

  // Artwork paints on the body so it repeats for the whole page.
  // A fixed viewport image stops and leaves a flat band on tall leaves.
  if (theme.artwork) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`season-doodles pointer-events-none z-0 overflow-hidden${visibilityClass}`}
    >
      {theme.doodles.map((spot, index) => (
        <Spot key={`${theme.month}-${spot.doodle}-${index}`} spot={spot} />
      ))}
    </div>
  );
}
