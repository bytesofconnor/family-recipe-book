export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type DoodleName =
  | "apple"
  | "berry"
  | "cookie"
  | "corn"
  | "leaf"
  | "lilac"
  | "maple"
  | "mug"
  | "pie"
  | "pine"
  | "pumpkin"
  | "rain"
  | "rhubarb"
  | "robin"
  | "snow"
  | "squash"
  | "strawberry"
  | "tap"
  | "tomato"
  | "wave";

export type DoodleSpot = {
  doodle: DoodleName;
  top: string;
  right?: string;
  left?: string;
  size: string;
  rotate: number;
  tone: "action" | "cocoa" | "leaf" | "cool";
};

export type MonthTheme = {
  month: MonthNumber;
  room: string;
  paper: string;
  paperRaised: string;
  paperPress: string;
  ink: string;
  inkSoft: string;
  rule: string;
  cinnamon: string;
  cinnamonDeep: string;
  cocoa: string;
  leaf: string;
  washWarm: string;
  washCool: string;
  artwork?: {
    desktop: string;
    mobile: string;
  };
  doodles: DoodleSpot[];
};

type Gutter = "tr" | "hr" | "br" | "tl" | "ml" | "bl";

const GUTTER: Record<
  Gutter,
  Pick<DoodleSpot, "top" | "right" | "left" | "size">
> = {
  tr: { top: "1%", right: "0.3%", size: "9.2rem" },
  hr: { top: "34%", right: "0.1%", size: "7.6rem" },
  br: { top: "67%", right: "0.4%", size: "8.2rem" },
  tl: { top: "4%", left: "0.3%", size: "8rem" },
  ml: { top: "38%", left: "0.1%", size: "7.2rem" },
  bl: { top: "71%", left: "0.2%", size: "7.8rem" },
};

function spot(
  doodle: DoodleName,
  gutter: Gutter,
  rotate: number,
  tone: DoodleSpot["tone"],
  tweak?: Partial<DoodleSpot>,
): DoodleSpot {
  return { doodle, rotate, tone, ...GUTTER[gutter], ...tweak };
}

const THEMES: Record<MonthNumber, MonthTheme> = {
  1: {
    month: 1,
    room: "#1a3348",
    paper: "#edf2ef",
    paperRaised: "#f8fbf8",
    paperPress: "#c9d5d2",
    ink: "#12181c",
    inkSoft: "#3e4e54",
    rule: "#9caeb0",
    cinnamon: "#a63b38",
    cinnamonDeep: "#7e2928",
    cocoa: "#2a201c",
    leaf: "#284b3f",
    washWarm: "#8a6a55",
    washCool: "#5a8499",
    artwork: {
      desktop: "/themes/january-deep-winter.webp",
      mobile: "/themes/january-deep-winter-mobile.webp",
    },
    doodles: [
      spot("pine", "tr", -8, "leaf"),
      spot("snow", "hr", 14, "cool", { size: "4.4rem" }),
      spot("mug", "br", 8, "cocoa"),
      spot("pine", "tl", 6, "leaf"),
      spot("snow", "ml", -12, "cool", { size: "3.6rem" }),
      spot("snow", "bl", 18, "cool", { size: "3.2rem" }),
    ],
  },
  2: {
    month: 2,
    room: "#243a52",
    paper: "#f0f4f7",
    paperRaised: "#f8fbfc",
    paperPress: "#c8d4de",
    ink: "#141c24",
    inkSoft: "#445664",
    rule: "#a8b8c4",
    cinnamon: "#a63b45",
    cinnamonDeep: "#7f2833",
    cocoa: "#2a2420",
    leaf: "#2a4a38",
    washWarm: "#9a7068",
    washCool: "#6a8aa0",
    artwork: {
      desktop: "/themes/february-winter-hearth.webp",
      mobile: "/themes/february-winter-hearth-mobile.webp",
    },
    doodles: [
      spot("pine", "tr", 4, "leaf"),
      spot("mug", "hr", -8, "action"),
      spot("cookie", "br", 10, "cocoa"),
      spot("snow", "tl", 16, "cool", { size: "4rem" }),
      spot("berry", "ml", 8, "action"),
      spot("snow", "bl", -10, "cool", { size: "3.4rem" }),
    ],
  },
  3: {
    month: 3,
    room: "#3f4a28",
    paper: "#f3ebe0",
    paperRaised: "#faf4ea",
    paperPress: "#d8c8b0",
    ink: "#22180e",
    inkSoft: "#5a4632",
    rule: "#c8b088",
    cinnamon: "#b56d18",
    cinnamonDeep: "#86500f",
    cocoa: "#3e2a14",
    leaf: "#3e4e28",
    washWarm: "#d4a84a",
    washCool: "#7a9a70",
    artwork: {
      desktop: "/themes/march-maple-thaw.webp",
      mobile: "/themes/march-maple-thaw-mobile.webp",
    },
    doodles: [
      spot("tap", "tr", -6, "cocoa"),
      spot("rain", "hr", 10, "cool", { size: "5.2rem" }),
      spot("leaf", "br", 16, "leaf"),
      spot("mug", "tl", -10, "action"),
      spot("rain", "ml", 8, "cool", { size: "4.2rem" }),
      spot("tap", "bl", 4, "cocoa", { size: "5.8rem" }),
    ],
  },
  4: {
    month: 4,
    room: "#2f4a36",
    paper: "#edf2ed",
    paperRaised: "#f6faf6",
    paperPress: "#c8d8c8",
    ink: "#142018",
    inkSoft: "#3e5244",
    rule: "#9cb8a0",
    cinnamon: "#bc4d51",
    cinnamonDeep: "#92363d",
    cocoa: "#2e241c",
    leaf: "#587454",
    washWarm: "#c8b85a",
    washCool: "#6f92a2",
    artwork: {
      desktop: "/themes/april-spring-thaw.webp",
      mobile: "/themes/april-spring-thaw-mobile.webp",
    },
    doodles: [
      spot("rhubarb", "tr", -10, "action"),
      spot("robin", "hr", 6, "cocoa"),
      spot("leaf", "br", -14, "leaf"),
      spot("rain", "tl", 10, "cool", { size: "4.8rem" }),
      spot("rhubarb", "ml", 8, "action", { size: "5.6rem" }),
      spot("leaf", "bl", 12, "leaf"),
    ],
  },
  5: {
    month: 5,
    room: "#3a4e32",
    paper: "#f4eef8",
    paperRaised: "#fbf8ff",
    paperPress: "#d4c8e0",
    ink: "#1c1424",
    inkSoft: "#4e4060",
    rule: "#b8a4c8",
    cinnamon: "#80579b",
    cinnamonDeep: "#604075",
    cocoa: "#322440",
    leaf: "#2e6a40",
    washWarm: "#c8c06a",
    washCool: "#76a277",
    artwork: {
      desktop: "/themes/may-lilac-rhubarb.webp",
      mobile: "/themes/may-lilac-rhubarb-mobile.webp",
    },
    doodles: [
      spot("lilac", "tr", -8, "action"),
      spot("leaf", "hr", 16, "leaf"),
      spot("lilac", "br", 10, "action", { size: "6.6rem" }),
      spot("leaf", "tl", -12, "leaf"),
      spot("rain", "ml", 8, "cool", { size: "4rem" }),
      spot("lilac", "bl", 6, "cocoa", { size: "5.8rem" }),
    ],
  },
  6: {
    month: 6,
    room: "#6a3d48",
    paper: "#fbf0e9",
    paperRaised: "#fffaf8",
    paperPress: "#f0c8c4",
    ink: "#241012",
    inkSoft: "#6a3838",
    rule: "#e8a8a4",
    cinnamon: "#c73d3d",
    cinnamonDeep: "#9e292c",
    cocoa: "#4a1c1c",
    leaf: "#2e6a32",
    washWarm: "#e08a90",
    washCool: "#72a663",
    artwork: {
      desktop: "/themes/june-strawberry-peony.webp",
      mobile: "/themes/june-strawberry-peony-mobile.webp",
    },
    doodles: [
      spot("strawberry", "tr", -8, "action"),
      spot("leaf", "hr", 14, "leaf"),
      spot("berry", "br", 8, "action"),
      spot("strawberry", "tl", 10, "cocoa"),
      spot("leaf", "ml", -12, "leaf"),
      spot("strawberry", "bl", 6, "action", { size: "5.8rem" }),
    ],
  },
  7: {
    month: 7,
    room: "#1a4a5c",
    paper: "#eef6f8",
    paperRaised: "#f6fcfe",
    paperPress: "#c0d8e0",
    ink: "#101820",
    inkSoft: "#365060",
    rule: "#8cb4c0",
    cinnamon: "#bd3d35",
    cinnamonDeep: "#922923",
    cocoa: "#2e2018",
    leaf: "#396b47",
    washWarm: "#d39a2f",
    washCool: "#4b78a4",
    artwork: {
      desktop: "/themes/july-lake-berries.webp",
      mobile: "/themes/july-lake-berries-mobile.webp",
    },
    doodles: [
      spot("wave", "tr", -6, "cool", { size: "9rem" }),
      spot("tomato", "hr", 8, "action"),
      spot("berry", "br", 10, "action"),
      spot("wave", "tl", 4, "cool", { size: "7.4rem" }),
      spot("rain", "ml", -8, "cool", { size: "4.6rem" }),
      spot("tomato", "bl", 6, "cocoa"),
    ],
  },
  8: {
    month: 8,
    room: "#5c4a30",
    paper: "#f8f0d9",
    paperRaised: "#fffbeb",
    paperPress: "#ebd4a0",
    ink: "#221808",
    inkSoft: "#6a4a20",
    rule: "#e0b85a",
    cinnamon: "#c54027",
    cinnamonDeep: "#99301e",
    cocoa: "#4a240c",
    leaf: "#47713b",
    washWarm: "#dba52c",
    washCool: "#6c8a42",
    artwork: {
      desktop: "/themes/august-garden-harvest.webp",
      mobile: "/themes/august-garden-harvest-mobile.webp",
    },
    doodles: [
      spot("corn", "tr", -10, "action"),
      spot("tomato", "hr", 10, "action"),
      spot("leaf", "br", 16, "leaf"),
      spot("corn", "tl", 8, "cocoa"),
      spot("tomato", "ml", -6, "action"),
      spot("corn", "bl", 4, "action", { size: "6.4rem" }),
    ],
  },
  9: {
    month: 9,
    room: "#6b3218",
    paper: "#f4ead8",
    paperRaised: "#fffaf0",
    paperPress: "#dfcfb3",
    ink: "#2c1f1a",
    inkSoft: "#665044",
    rule: "#cda66a",
    cinnamon: "#b4532a",
    cinnamonDeep: "#8f3b20",
    cocoa: "#4b3027",
    leaf: "#66703a",
    washWarm: "#d4882c",
    washCool: "#8a5a38",
    artwork: {
      desktop: "/themes/september-harvest.webp",
      mobile: "/themes/september-harvest-mobile.webp",
    },
    doodles: [
      spot("apple", "tr", -8, "action"),
      spot("leaf", "hr", 14, "leaf", { size: "5.4rem" }),
      spot("corn", "br", -6, "action"),
      spot("leaf", "tl", 12, "leaf"),
      spot("apple", "ml", 8, "action", { size: "5.6rem" }),
      spot("squash", "bl", 8, "cocoa"),
    ],
  },
  10: {
    month: 10,
    room: "#5a2214",
    paper: "#f6e6d0",
    paperRaised: "#fff0dc",
    paperPress: "#e0b888",
    ink: "#221008",
    inkSoft: "#6a3418",
    rule: "#d48848",
    cinnamon: "#c44b22",
    cinnamonDeep: "#963417",
    cocoa: "#4a1808",
    leaf: "#72703d",
    washWarm: "#d17b24",
    washCool: "#8a6040",
    artwork: {
      desktop: "/themes/october-maple-harvest.webp",
      mobile: "/themes/october-maple-harvest-mobile.webp",
    },
    doodles: [
      spot("maple", "tr", -12, "action"),
      spot("pumpkin", "hr", 6, "cocoa"),
      spot("apple", "br", 12, "action"),
      spot("maple", "tl", 14, "action", { size: "6.6rem" }),
      spot("leaf", "ml", -16, "leaf"),
      spot("pumpkin", "bl", 8, "cocoa"),
    ],
  },
  11: {
    month: 11,
    room: "#4a2418",
    paper: "#f0ebe4",
    paperRaised: "#f7f3ee",
    paperPress: "#d0c8be",
    ink: "#1c1814",
    inkSoft: "#5a4e46",
    rule: "#b8aaa0",
    cinnamon: "#9f3740",
    cinnamonDeep: "#77262e",
    cocoa: "#322820",
    leaf: "#6b633f",
    washWarm: "#c06040",
    washCool: "#7a6050",
    artwork: {
      desktop: "/themes/november-wild-rice.webp",
      mobile: "/themes/november-wild-rice-mobile.webp",
    },
    doodles: [
      spot("pie", "tr", 8, "action"),
      spot("squash", "hr", -6, "cocoa"),
      spot("leaf", "br", 20, "leaf"),
      spot("squash", "tl", 6, "cocoa"),
      spot("rain", "ml", -8, "cool", { size: "4.4rem" }),
      spot("pie", "bl", 4, "action", { size: "5.8rem" }),
    ],
  },
  12: {
    month: 12,
    room: "#1a3548",
    paper: "#f2efe6",
    paperRaised: "#faf8f0",
    paperPress: "#d4ccb8",
    ink: "#141410",
    inkSoft: "#4a4034",
    rule: "#b8a888",
    cinnamon: "#a62e35",
    cinnamonDeep: "#7d1f27",
    cocoa: "#2e1c10",
    leaf: "#1a4a30",
    washWarm: "#8a7060",
    washCool: "#4a7088",
    artwork: {
      desktop: "/themes/december-pine-pantry.webp",
      mobile: "/themes/december-pine-pantry-mobile.webp",
    },
    doodles: [
      spot("pine", "tr", -6, "leaf"),
      spot("cookie", "hr", 10, "cocoa"),
      spot("berry", "br", 8, "action"),
      spot("pine", "tl", 4, "leaf"),
      spot("snow", "ml", 14, "cool", { size: "4.2rem" }),
      spot("snow", "bl", -10, "cool", { size: "3.6rem" }),
    ],
  },
};

export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function parseMonthParam(value: string | null): MonthNumber | null {
  const forced = Number(value);
  if (forced >= 1 && forced <= 12) {
    return forced as MonthNumber;
  }
  return null;
}

export function liveMinnesotaMonth(now = new Date()): MonthNumber {
  const parsed = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "numeric",
    }).format(now),
  );

  if (parsed >= 1 && parsed <= 12) {
    return parsed as MonthNumber;
  }

  return 9;
}

export function minnesotaMonth(now = new Date()): MonthNumber {
  if (typeof window !== "undefined") {
    const forced = parseMonthParam(
      new URLSearchParams(window.location.search).get("month"),
    );
    if (forced) {
      return forced;
    }
  }

  return liveMinnesotaMonth(now);
}

export function themeForMonth(month: MonthNumber = minnesotaMonth()): MonthTheme {
  return THEMES[month];
}

export function applySeasonTheme(month: MonthNumber = minnesotaMonth()): MonthTheme {
  const theme = themeForMonth(month);
  const root = document.documentElement;
  root.dataset.month = String(theme.month);
  root.style.setProperty("--color-room", theme.room);
  root.style.setProperty("--color-paper", theme.paper);
  root.style.setProperty("--color-paper-raised", theme.paperRaised);
  root.style.setProperty("--color-paper-press", theme.paperPress);
  root.style.setProperty("--color-ink", theme.ink);
  root.style.setProperty("--color-ink-soft", theme.inkSoft);
  root.style.setProperty("--color-rule", theme.rule);
  root.style.setProperty("--color-cinnamon", theme.cinnamon);
  root.style.setProperty("--color-cinnamon-deep", theme.cinnamonDeep);
  root.style.setProperty("--color-cocoa", theme.cocoa);
  root.style.setProperty("--color-leaf", theme.leaf);
  root.style.setProperty("--color-wash-warm", theme.washWarm);
  root.style.setProperty("--color-wash-cool", theme.washCool);
  if (theme.artwork) {
    root.style.setProperty("--season-art-desktop", `url("${theme.artwork.desktop}")`);
    root.style.setProperty("--season-art-mobile", `url("${theme.artwork.mobile}")`);
  } else {
    root.style.removeProperty("--season-art-desktop");
    root.style.removeProperty("--season-art-mobile");
  }
  return theme;
}
