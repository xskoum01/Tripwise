import { AIRLINE_BY_ID } from "./airlines";

// ── Legacy narrow type kept for backward-compat with getAirlineLink callers ──

type AirlineLink = {
  url: string;
  label: string;
};

const byIata: Record<string, AirlineLink> = {
  FR: { url: "https://www.ryanair.com/cz/cs", label: "Ryanair" },
  W6: { url: "https://wizzair.com", label: "Wizz Air" },
  QS: { url: "https://www.smartwings.com", label: "Smartwings" },
  VY: { url: "https://www.vueling.com", label: "Vueling" },
  U2: { url: "https://www.easyjet.com", label: "easyJet" },
  EW: { url: "https://www.eurowings.com", label: "Eurowings" },
  PC: { url: "https://www.flypgs.com", label: "Pegasus" },
  XQ: { url: "https://www.sunexpress.com", label: "SunExpress" },
  HV: { url: "https://www.transavia.com", label: "Transavia" },
  TO: { url: "https://www.transavia.com", label: "Transavia" },
  DY: { url: "https://www.norwegian.com", label: "Norwegian" },
  D8: { url: "https://www.norwegian.com", label: "Norwegian" },
  V7: { url: "https://www.volotea.com", label: "Volotea" },
  BT: { url: "https://www.airbaltic.com", label: "airBaltic" },
  VF: { url: "https://www.ajet.com", label: "AJet" },
  XC: { url: "https://www.corendonairlines.com", label: "Corendon" },
  SM: { url: "https://aircairo.com", label: "Air Cairo" },
  DE: { url: "https://www.condor.com", label: "Condor" },
  LS: { url: "https://www.jet2.com", label: "Jet2" },
  LH: { url: "https://www.lufthansa.com", label: "Lufthansa" },
  OS: { url: "https://www.austrian.com", label: "Austrian" },
  IB: { url: "https://www.iberia.com", label: "Iberia" },
};

const byName: Array<{ patterns: string[]; link: AirlineLink }> = [
  { patterns: ["ryanair"], link: byIata.FR },
  { patterns: ["wizz"], link: byIata.W6 },
  { patterns: ["smartwings"], link: byIata.QS },
  { patterns: ["vueling"], link: byIata.VY },
  { patterns: ["easyjet", "easy jet"], link: byIata.U2 },
  { patterns: ["eurowings"], link: byIata.EW },
  { patterns: ["pegasus", "flypgs"], link: byIata.PC },
  { patterns: ["sunexpress"], link: byIata.XQ },
  { patterns: ["transavia"], link: byIata.HV },
  { patterns: ["norwegian"], link: byIata.DY },
  { patterns: ["volotea"], link: byIata.V7 },
  { patterns: ["airbaltic", "air baltic"], link: byIata.BT },
  { patterns: ["ajet"], link: byIata.VF },
  { patterns: ["corendon"], link: byIata.XC },
  { patterns: ["air cairo", "aircairo"], link: byIata.SM },
  { patterns: ["condor"], link: byIata.DE },
  { patterns: ["jet2"], link: byIata.LS },
  { patterns: ["lufthansa"], link: byIata.LH },
  { patterns: ["austrian"], link: byIata.OS },
  { patterns: ["iberia"], link: byIata.IB },
];

export function getAirlineLink(carrierName?: string, iataCode?: string): AirlineLink | undefined {
  if (iataCode) {
    const found = byIata[iataCode.toUpperCase()];
    if (found) return found;
  }
  if (carrierName) {
    const lower = carrierName.toLowerCase();
    for (const { patterns, link } of byName) {
      if (patterns.some((p) => lower.includes(p))) return link;
    }
  }
  return undefined;
}

export function extractIataFromFlightNumber(flightNumber?: string): string | undefined {
  if (!flightNumber) return undefined;
  const match = /^([A-Z]{2})/.exec(flightNumber);
  return match?.[1];
}

// ── New structured verification link builder ─────────────────────────────────

export type AirlineVerificationInput = {
  airlineId: string;
  carrierName?: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults?: number;
  currency?: string;
  locale?: string;
};

export type AirlineVerificationLink = {
  url: string;
  label: string;
  linkKind: "homepage" | "search" | "exact";
  note: string;
};

const HOMEPAGE_NOTE = "Otevře web aerolinky. Dostupnost a cenu ověř ručně.";
const SEARCH_NOTE = "Otevře vyhledávání u aerolinky. Tripwise nezískal cenu automaticky — ověř ručně.";

// Ryanair: build a prefilled trip-select search URL.
function ryanairSearchLink(input: AirlineVerificationInput): AirlineVerificationLink {
  const params = new URLSearchParams({
    adults: String(input.adults ?? 1),
    teens: "0",
    children: "0",
    infants: "0",
    dateOut: input.departDate,
    dateIn: input.returnDate,
    originIata: input.origin,
    destinationIata: input.destination,
    isConnectedFlight: "false",
    discount: "0",
    promoCode: "",
    isReturn: "true",
  });
  return {
    url: `https://www.ryanair.com/cz/cs/trip/flights/select?${params.toString()}`,
    label: "Ověřit hledání u Ryanairu",
    linkKind: "search",
    note: SEARCH_NOTE,
  };
}

// Homepage fallback used for airlines without a stable search URL pattern.
function homepageLink(airlineId: string): AirlineVerificationLink {
  const airline = AIRLINE_BY_ID.get(airlineId);
  return {
    url: airline?.websiteUrl ?? "https://www.google.com/travel/flights",
    label: `Otevřít web ${airline?.name ?? airlineId}`,
    linkKind: "homepage",
    note: HOMEPAGE_NOTE,
  };
}

/**
 * Builds the best available verification link for a given airline and route.
 * Never marks a result as "exact" unless a confirmed bookable offer URL is known.
 */
export function buildAirlineVerificationLink(input: AirlineVerificationInput): AirlineVerificationLink {
  try {
    switch (input.airlineId) {
      case "ryanair":
        return ryanairSearchLink(input);
      // All other airlines use homepage until a stable search URL pattern is confirmed.
      // Add per-airline search builders here when formats are validated.
      default:
        return homepageLink(input.airlineId);
    }
  } catch {
    return homepageLink(input.airlineId);
  }
}
