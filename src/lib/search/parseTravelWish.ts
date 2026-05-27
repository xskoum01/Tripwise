import type { AirportCode, DestinationMode, TravelSearchRequest } from "./types";

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
  const origins = new Set<AirportCode>();
  if (/\b(praha|prahy|prg)\b/.test(text)) origins.add("PRG");
  if (/\b(viden|vidne|vienna|vie)\b/.test(text)) origins.add("VIE");
  if (/\b(brno|brna|brq)\b/.test(text)) origins.add("BRQ");
  if (/\b(pardubice|pardubic|ped)\b/.test(text)) origins.add("PED");
  return [...origins];
}

function inferMonth(text: string) {
  const months: Array<[number, string[]]> = [
    [1, ["leden", "lednu"]],
    [2, ["unor", "unoru"]],
    [3, ["brezen", "breznu"]],
    [4, ["duben", "dubnu"]],
    [5, ["kveten", "kvetnu"]],
    [6, ["cerven", "cervnu"]],
    [7, ["cervenec", "cervenci"]],
    [8, ["srpen", "srpnu"]],
    [9, ["zari"]],
    [10, ["rijen", "rijnu"]],
    [11, ["listopad", "listopadu"]],
    [12, ["prosinec", "prosinci"]],
  ];

  return months.find(([, names]) => names.some((name) => text.includes(name)))?.[0];
}

function getMonthRange(month: number, today = new Date()) {
  const currentMonth = today.getMonth() + 1;
  const year = month >= currentMonth ? today.getFullYear() : today.getFullYear() + 1;
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

function inferDestinationMode(text: string): DestinationMode | undefined {
  if (/\b(k mori|more|plaz)\b/.test(text)) return "sea";
  if (/\b(za teplem|teplo)\b/.test(text)) return "warm";
  if (/\b(city break|mesto|eurovikend)\b/.test(text)) return "cityBreak";
  return undefined;
}

function inferTemperature(text: string) {
  const match = text.match(/\b(?:alespon|aspon|minimalne|min|nad)\s*(\d{1,2})\s*(?:stupnu|stupne|c|\u00b0c)?\b/);
  return match ? Number(match[1]) : undefined;
}

export function parseTravelWish(wish: string, base: Partial<TravelSearchRequest> = {}): TravelSearchRequest {
  const text = normalizeText(wish);
  const budgetMatch = text.match(/(?:do|max)\s*([0-9][0-9\s.]*)/);
  const lengthMatch = text.match(/\b(\d+)\s*(?:-|\u2013|az)\s*(\d+)\s*(?:dni|dny|noci|noc)\b/);
  const exactLengthMatch = text.match(/\b(\d+)\s*(?:dni|dny|noci|noc)\b/);
  const origins = inferOrigins(text);
  const targetMonth = inferMonth(text);
  const destinationMode = inferDestinationMode(text);
  const minTemperatureC = inferTemperature(text);

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
  if (targetMonth) {
    const range = getMonthRange(targetMonth);
    parsed.targetMonth = targetMonth;
    parsed.dateFrom = range.dateFrom;
    parsed.dateTo = range.dateTo;
  }
  if (minTemperatureC !== undefined) parsed.minTemperatureC = minTemperatureC;
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
