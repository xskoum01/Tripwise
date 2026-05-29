export type AirportDefinition = {
  code: string;
  city: string;
  displayName: string;
  country: string;
  priority: number;
  convenienceScore: number;
  enabledByDefault: boolean;
  notes?: string;
};

// Origin airports in scope for personal CZ/SK/AT trip hunting.
// Priority 1 = first choice, higher number = less convenient.
export const ORIGIN_AIRPORTS: AirportDefinition[] = [
  {
    code: "PRG",
    city: "Praha",
    displayName: "Praha (PRG)",
    country: "Česko",
    priority: 1,
    convenienceScore: 100,
    enabledByDefault: true,
    notes: "Hlavní hub. Největší výběr aerolinií a destinací.",
  },
  {
    code: "VIE",
    city: "Vídeň",
    displayName: "Vídeň (VIE)",
    country: "Rakousko",
    priority: 2,
    convenienceScore: 85,
    enabledByDefault: true,
    notes: "Druhý největší hub v regionu. Silná pokrytí low-cost i network carriers.",
  },
  {
    code: "BTS",
    city: "Bratislava",
    displayName: "Bratislava (BTS)",
    country: "Slovensko",
    priority: 3,
    convenienceScore: 70,
    enabledByDefault: false,
    notes: "Ryanair hub. Dobrá dostupnost z jihu Moravy. Wizz Air silný výběr.",
  },
  {
    code: "BRQ",
    city: "Brno",
    displayName: "Brno (BRQ)",
    country: "Česko",
    priority: 4,
    convenienceScore: 60,
    enabledByDefault: false,
    notes: "Omezený výběr dopravců. Sezónní lety Ryanair a charterové linky.",
  },
  {
    code: "OSR",
    city: "Ostrava",
    displayName: "Ostrava (OSR)",
    country: "Česko",
    priority: 5,
    convenienceScore: 50,
    enabledByDefault: false,
    notes: "Ltiško Ostrava-Mošnov. Ryanair sezónní lety, jinak omezené.",
  },
  {
    code: "PED",
    city: "Pardubice",
    displayName: "Pardubice (PED)",
    country: "Česko",
    priority: 6,
    convenienceScore: 40,
    enabledByDefault: false,
    notes: "Velmi omezený výběr. Sezónní charterové lety (Egypt, Turecko).",
  },
];

export const AIRPORT_BY_CODE = new Map(ORIGIN_AIRPORTS.map((a) => [a.code, a]));
