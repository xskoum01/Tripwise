import type { DatePrecision, DestinationMode, OriginAirport, TravelSearchRequest } from "./types";

export const defaultSearchRequest: TravelSearchRequest = {
  wish: "",
  origins: ["PRG", "VIE"],
  maxBudget: 7000,
  minNights: 3,
  maxNights: 5,
  baggage: "backpack",
  avoidEarlyFlights: false,
  directOnly: false,
  weekendOnly: false,
  destinationMode: "any",
  intent: "value",
  assumptions: ["Pokud nezadáte délku cesty, hledáme výchozí délku 3-5 nocí."],
  unsupportedConstraints: [],
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function inferOrigins(text: string) {
  const origins = new Set<OriginAirport>();
  if (/\b(praha|prahy|prg)\b/.test(text)) origins.add("PRG");
  if (/\b(viden|vidne|vienna|vie)\b/.test(text)) origins.add("VIE");
  if (/\b(bratislava|bratislavy|bts)\b/.test(text)) origins.add("BTS");
  if (/\b(brno|brna|brq)\b/.test(text)) origins.add("BRQ");
  if (/\b(ostrava|ostravy|osr)\b/.test(text)) origins.add("OSR");
  if (/\b(pardubice|pardubic|ped)\b/.test(text)) origins.add("PED");
  return [...origins];
}

// Normalized Czech month word → month number.
// July forms (cervenec/cervenci/cervence) come before June forms (cerven/cervna/cervnu)
// to prevent substring collision: "cervenec" contains "cerven", so July must win.
const MONTH_WORD_MAP: Record<string, number> = {
  leden: 1, lednu: 1, ledna: 1,
  unor: 2, unoru: 2, unora: 2,
  brezen: 3, breznu: 3, brezna: 3,
  duben: 4, dubnu: 4, dubna: 4,
  kveten: 5, kvetnu: 5, kvetna: 5,
  cervenec: 7, cervenci: 7, cervence: 7,   // July — MUST be before June entries
  cerven: 6, cervnu: 6, cervna: 6,
  srpen: 8, srpnu: 8, srpna: 8,
  zari: 9,
  rijen: 10, rijnu: 10, rijna: 10,
  listopad: 11, listopadu: 11,
  prosinec: 12, prosinci: 12, prosince: 12,
};

// Czech month names in genitive form for user-facing labels
const MONTH_LABELS_GENITIVE = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

// Search for month names in normalized text, checking July forms before June
// to avoid false positives ("cervenec" contains "cerven").
function inferMonth(text: string): number | undefined {
  const ordered: Array<[number, string[]]> = [
    [7, ["cervenec", "cervenci", "cervence"]],   // July before June!
    [6, ["cerven", "cervnu", "cervna"]],
    [1, ["leden", "lednu", "ledna"]],
    [2, ["unor", "unoru", "unora"]],
    [3, ["brezen", "breznu", "brezna"]],
    [4, ["duben", "dubnu", "dubna"]],
    [5, ["kveten", "kvetnu", "kvetna"]],
    [8, ["srpen", "srpnu", "srpna"]],
    [9, ["zari"]],
    [10, ["rijen", "rijnu", "rijna"]],
    [11, ["listopad", "listopadu"]],
    [12, ["prosinec", "prosinci", "prosince"]],
  ];
  return ordered.find(([, names]) => names.some((name) => text.includes(name)))?.[0];
}

function getMonthRange(month: number, today = new Date()) {
  const currentMonth = today.getMonth() + 1;
  const year = month >= currentMonth ? today.getFullYear() : today.getFullYear() + 1;
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

function fmt(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Returns the year to use for a date window starting on (month, day).
// Uses current year if that date is today or later, otherwise next year.
function yearFor(month: number, day: number, today: Date): number {
  const year = today.getFullYear();
  return new Date(year, month - 1, day) >= today ? year : year + 1;
}

type DateWindow = {
  targetMonth?: number;
  dateFrom: string;
  dateTo: string;
  datePrecision: DatePrecision;
  dateLabel: string;
};

/**
 * Parses Czech natural language date phrases from normalized text and returns
 * a structured date window. Returns undefined when no phrase is detected so
 * the caller can fall back to plain month detection.
 *
 * Handles:
 *   - month transitions  "přelom [m1] a/[/] [m2]"
 *   - early month        "začátkem/začátku/první část [m]"
 *   - mid month          "v půlce/v polovině/kolem poloviny [m]"
 *   - late month         "na konci/koncem/poslední část [m]"
 *   - week               "[první|druhý|třetí|čtvrtý|poslední] týden v [m]"
 */
export function inferDateWindow(normalizedText: string, today = new Date()): DateWindow | undefined {
  const w = (word: string) => MONTH_WORD_MAP[word];

  // 1. Month transition: "přelom [m1] a [m2]" / "přelom [m1]/[m2]"
  const transMatch = normalizedText.match(
    /prelom(?:u)?\s+([a-z]+)(?:\s+a\s+|\s*\/\s*|\s+)([a-z]+)/,
  );
  if (transMatch) {
    const m1 = w(transMatch[1]);
    const m2 = w(transMatch[2]);
    if (m1 && m2 && m1 !== m2) {
      // Year is determined by when the transition ends (7th of m2)
      const m2Year = yearFor(m2, 7, today);
      const m1Year = m1 < m2 ? m2Year : m2Year - 1; // handles Dec→Jan
      const lastDayM1 = lastDayOf(m1Year, m1);
      return {
        dateFrom: fmt(m1Year, m1, lastDayM1 - 6),
        dateTo: fmt(m2Year, m2, 7),
        datePrecision: "month-transition",
        dateLabel: `přelom ${MONTH_LABELS_GENITIVE[m1 - 1]} a ${MONTH_LABELS_GENITIVE[m2 - 1]} ${m1Year}`,
      };
    }
  }

  // 2. Early month: "začátkem [m]", "na začátku [m]", "první část [m]"
  const earlyMatch =
    normalizedText.match(/(?:na\s+)?zacatk(?:u|em)\s+([a-z]+)/) ??
    normalizedText.match(/prvni\s+cast\s+([a-z]+)/);
  if (earlyMatch) {
    const m = w(earlyMatch[1]);
    if (m) {
      const year = yearFor(m, 1, today);
      return {
        targetMonth: m,
        dateFrom: fmt(year, m, 1),
        dateTo: fmt(year, m, 10),
        datePrecision: "early-month",
        dateLabel: `začátek ${MONTH_LABELS_GENITIVE[m - 1]} ${year}`,
      };
    }
  }

  // 3. Mid month: "v půlce [m]", "v polovině [m]", "kolem poloviny [m]"
  const midMatch =
    normalizedText.match(/(?:v\s+)?pulce\s+([a-z]+)/) ??
    normalizedText.match(/(?:v\s+)?polovin[ey]\s+([a-z]+)/) ??
    normalizedText.match(/kolem\s+poloviny\s+([a-z]+)/);
  if (midMatch) {
    const m = w(midMatch[1]);
    if (m) {
      const year = yearFor(m, 11, today);
      return {
        targetMonth: m,
        dateFrom: fmt(year, m, 11),
        dateTo: fmt(year, m, 20),
        datePrecision: "mid-month",
        dateLabel: `polovina ${MONTH_LABELS_GENITIVE[m - 1]} ${year}`,
      };
    }
  }

  // 4. Late month: "na konci [m]", "koncem [m]", "poslední část [m]"
  const lateMatch =
    normalizedText.match(/(?:na\s+)?konc(?:i|em)\s+([a-z]+)/) ??
    normalizedText.match(/posledni\s+cast\s+([a-z]+)/);
  if (lateMatch) {
    const m = w(lateMatch[1]);
    if (m) {
      const year = yearFor(m, 21, today);
      const lastDay = lastDayOf(year, m);
      return {
        targetMonth: m,
        dateFrom: fmt(year, m, 21),
        dateTo: fmt(year, m, lastDay),
        datePrecision: "late-month",
        dateLabel: `konec ${MONTH_LABELS_GENITIVE[m - 1]} ${year}`,
      };
    }
  }

  // 5. Week: "[ordinal] týden v [m]"
  const weekMatch = normalizedText.match(
    /(prvni|druhy|treti|ctvrty|posledni)\s+tyden\s+(?:v\s+)?([a-z]+)/,
  );
  if (weekMatch) {
    const ordinal = weekMatch[1];
    const m = w(weekMatch[2]);
    if (m) {
      const weekStartDays: Record<string, number> = { prvni: 1, druhy: 8, treti: 15, ctvrty: 22 };
      const weekLabels: Record<string, string> = {
        prvni: "první", druhy: "druhý", treti: "třetí", ctvrty: "čtvrtý", posledni: "poslední",
      };

      if (ordinal === "posledni") {
        // Approximate start day using current year to select the correct year,
        // then recompute with the actual year's month length.
        const approxStart = lastDayOf(today.getFullYear(), m) - 6;
        const year = yearFor(m, approxStart, today);
        const lastDay = lastDayOf(year, m);
        return {
          targetMonth: m,
          dateFrom: fmt(year, m, lastDay - 6),
          dateTo: fmt(year, m, lastDay),
          datePrecision: "week",
          dateLabel: `poslední týden ${MONTH_LABELS_GENITIVE[m - 1]} ${year}`,
        };
      }

      const startDay = weekStartDays[ordinal];
      const year = yearFor(m, startDay, today);
      return {
        targetMonth: m,
        dateFrom: fmt(year, m, startDay),
        dateTo: fmt(year, m, startDay + 6),
        datePrecision: "week",
        dateLabel: `${weekLabels[ordinal]} týden ${MONTH_LABELS_GENITIVE[m - 1]} ${year}`,
      };
    }
  }

  return undefined;
}

function inferDestinationMode(text: string): DestinationMode | undefined {
  if (/\b(k mori|more|plaz)\b/.test(text)) return "sea";
  if (/\b(za teplem|teplo)\b/.test(text)) return "warm";
  if (/\b(city break|mesto|eurovikend)\b/.test(text)) return "cityBreak";
  return undefined;
}

/**
 * Infers a minimum temperature preference from normalized (no-diacritics) text.
 * Matches patterns like:
 *   - "aspon X" / "aspon X stupnu" / "aspon X °c"
 *   - "alespon X" / "alespon X stupnu"
 *   - "minimalne X" / "minimalne X °c"
 *   - "min X"
 *   - "nad X stupni" / "nad X°c"
 */
function inferTemperature(text: string): number | undefined {
  const patterns = [
    // "nad X stupni" / "nad X°c" — "nad" before number without requiring word boundary after number
    /\bnad\s+(\d{1,2})\s*(?:stupni|stupnu|stupne|°c|c)\b/,
    // "aspon/alespon/minimalne/min X [unit]"
    /\b(?:alespon|aspon|minimalne|min)\s+(\d{1,2})\s*(?:stupnu|stupne|stupni|°c|c)?\b/,
    // bare "nad X" without explicit unit (only match if followed by word boundary or end)
    /\bnad\s+(\d{1,2})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/**
 * Infers a general weather preference from normalized (no-diacritics) text.
 * Returns the first matched preference string or undefined.
 *
 * Recognized preferences:
 *   "no-rain"  — "bez deste" / "bez deste"
 *   "warm"     — "kde bude teplo" / "za teplem" / "v teple"
 *   "sunny"    — "slunecno"
 */
function inferWeatherPreference(text: string): string | undefined {
  if (/\bbez\s+deste\b/.test(text)) return "no-rain";
  if (/\b(kde\s+bude\s+teplo|za\s+teplem|v\s+teple)\b/.test(text)) return "warm";
  if (/\bslunecno\b/.test(text)) return "sunny";
  return undefined;
}

export function parseTravelWish(wish: string, base: Partial<TravelSearchRequest> = {}): TravelSearchRequest {
  const text = normalizeText(wish);
  const budgetMatch = text.match(/(?:do|max)\s*([0-9][0-9\s.]*)/);
  const lengthMatch = text.match(/\b(\d+)\s*(?:-|–|az)\s*(\d+)\s*(?:dni|dny|noci|noc)\b/);
  const exactLengthMatch = text.match(/\b(\d+)\s*(?:dni|dny|noci|noc)\b/);
  const origins = inferOrigins(text);
  const destinationMode = inferDestinationMode(text);
  const minTemperatureC = inferTemperature(text);
  const weatherPreference = inferWeatherPreference(text);

  const parsed: TravelSearchRequest = {
    ...defaultSearchRequest,
    ...base,
    wish,
    assumptions: [...(base.assumptions ?? defaultSearchRequest.assumptions ?? [])],
    unsupportedConstraints: [...(base.unsupportedConstraints ?? [])],
  };

  if (destinationMode) parsed.destinationMode = destinationMode;
  if (text.includes("vikend")) parsed.weekendOnly = true;
  if (text.includes("bez prestupu") || text.includes("primy let") || text.includes("direct")) parsed.directOnly = true;
  if (text.includes("nejlevnejsi")) parsed.intent = "cheapest";
  if (text.includes("komfort") || text.includes("pohodl")) parsed.intent = "comfort";
  if (text.includes("cena/vykon") || text.includes("cena vykon")) parsed.intent = "value";
  if (text.includes("nechci odlet pred 6") || text.includes("ne pred 6") || text.includes("bez ranniho odletu")) {
    parsed.avoidEarlyFlights = true;
  }

  if (budgetMatch) parsed.maxBudget = Number(budgetMatch[1].replace(/[\s.]/g, ""));
  if (origins.length > 0) parsed.origins = origins;

  // Apply explicit temperature first; fall back to warm-weather baseline when
  // the user expressed a warm-destination preference but gave no explicit threshold.
  if (minTemperatureC !== undefined) {
    parsed.minTemperatureC = minTemperatureC;
  } else if (weatherPreference === "warm" || /\b(kde\s+bude\s+teplo|za\s+teplem)\b/.test(text)) {
    parsed.minTemperatureC = 18;
  }

  // Date window: try phrase-level parsing first, fall back to plain month
  const dateWindow = inferDateWindow(text);
  if (dateWindow) {
    parsed.dateFrom = dateWindow.dateFrom;
    parsed.dateTo = dateWindow.dateTo;
    parsed.datePrecision = dateWindow.datePrecision;
    parsed.dateLabel = dateWindow.dateLabel;
    if (dateWindow.targetMonth !== undefined) parsed.targetMonth = dateWindow.targetMonth;
  } else {
    const targetMonth = inferMonth(text);
    if (targetMonth) {
      const range = getMonthRange(targetMonth);
      parsed.targetMonth = targetMonth;
      parsed.dateFrom = range.dateFrom;
      parsed.dateTo = range.dateTo;
      parsed.datePrecision = "month";
    }
  }

  if (lengthMatch) {
    parsed.minNights = Number(lengthMatch[1]);
    parsed.maxNights = Number(lengthMatch[2]);
    parsed.assumptions = parsed.assumptions?.filter((item) => !item.includes("výchozí délku"));
  } else if (exactLengthMatch) {
    parsed.minNights = Number(exactLengthMatch[1]);
    parsed.maxNights = Number(exactLengthMatch[1]);
    parsed.assumptions = parsed.assumptions?.filter((item) => !item.includes("výchozí délku"));
  }

  return parsed;
}
