import { AIRLINE_BY_ID } from "./airlines";
import { AIRLINE_LINK_VALIDATION, type LinkValidationStatus } from "./airlineLinkValidation";

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

// ── Structured verification link builder ─────────────────────────────────────
//
// confidence levels:
//   high   — URL format confirmed stable; used in production by the airline's own frontend.
//   medium — URL format observed and likely stable but not formally documented.
//   low    — Best effort; format may change without notice. Useful but unverified.
//
// linkKind:
//   exact    — confirmed bookable offer URL (never used here — requires live offer ID).
//   search   — prefilled with route/date; opens airline search page.
//   homepage — only airline homepage; user must enter all details manually.

export type LinkConfidence = "high" | "medium" | "low";

export type AirlineVerificationInput = {
  airlineId: string;
  carrierName?: string;
  origin: string;
  destination: string;
  departDate: string;  // YYYY-MM-DD
  returnDate: string;  // YYYY-MM-DD
  adults?: number;
  currency?: string;
  locale?: string;
};

export type AirlineVerificationLink = {
  url: string;
  label: string;
  linkKind: "homepage" | "search" | "exact";
  confidence: LinkConfidence;
  note: string;
  validationStatus: LinkValidationStatus;
  lastValidatedAt?: string;
  validationNote?: string;
};

// ── Date format helpers ──────────────────────────────────────────────────────

// YYYY-MM-DD → DD/MM/YYYY  (Pegasus, Vueling)
function toDDMMYYYYSlash(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// YYYY-MM-DD → DDMMYYYY  (Transavia path segments)
function toDDMMYYYYRaw(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

// YYYY-MM-DD → DD.MM.YYYY  (Condor)
function toDDMMYYYYDot(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// YYYY-MM-DD → DD-Mon-YYYY  e.g. 01-Jul-2026  (Jet2)
function toJet2Date(iso: string): string {
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m, d] = iso.split("-");
  return `${d}-${MON[Number(m) - 1]}-${y}`;
}

// ── Per-airline builders ──────────────────────────────────────────────────────

const SEARCH_NOTE = "Otevře vyhledávání u aerolinky. Tripwise nezískal cenu automaticky — ověř ručně.";
const HOMEPAGE_NOTE = "Otevře web aerolinky. Vyplň trasu a datum ručně.";

function getValidation(airlineId: string) {
  return AIRLINE_LINK_VALIDATION[airlineId] ?? { validationStatus: "untested" as LinkValidationStatus };
}

function homepageLink(airlineId: string): AirlineVerificationLink {
  const airline = AIRLINE_BY_ID.get(airlineId);
  const v = getValidation(airlineId);
  return {
    url: airline?.websiteUrl ?? "https://www.google.com/travel/flights",
    label: `Otevřít web ${airline?.name ?? airlineId}`,
    linkKind: "homepage",
    confidence: "high",
    note: HOMEPAGE_NOTE,
    validationStatus: v.validationStatus,
    lastValidatedAt: v.lastValidatedAt,
    validationNote: v.validationNote,
  };
}

function searchLink(url: string, label: string, confidence: LinkConfidence, airlineId: string): AirlineVerificationLink {
  const v = getValidation(airlineId);
  return {
    url,
    label,
    linkKind: "search",
    confidence,
    note: SEARCH_NOTE,
    validationStatus: v.validationStatus,
    lastValidatedAt: v.lastValidatedAt,
    validationNote: v.validationNote,
  };
}

// ── Individual airline link builders ─────────────────────────────────────────

function ryanair(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    adults: String(i.adults ?? 1),
    teens: "0", children: "0", infants: "0",
    dateOut: i.departDate,
    dateIn: i.returnDate,
    originIata: i.origin,
    destinationIata: i.destination,
    isConnectedFlight: "false",
    discount: "0", promoCode: "",
    isReturn: "true",
  });
  return searchLink(`https://www.ryanair.com/cz/cs/trip/flights/select?${p}`, "Ověřit u Ryanairu", "high", "ryanair");
}

function wizz(i: AirlineVerificationInput): AirlineVerificationLink {
  const adults = i.adults ?? 1;
  return searchLink(
    `https://wizzair.com/en-gb/booking/select-flight/${i.origin}/${i.destination}/${i.departDate}/${i.returnDate}/${adults}/0/0/0/all`,
    "Ověřit u Wizz Air",
    "medium",
    "wizz",
  );
}

function easyjet(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({ departDate: i.departDate, returnDate: i.returnDate });
  const org = i.origin.toLowerCase();
  const dst = i.destination.toLowerCase();
  return searchLink(`https://www.easyjet.com/en/cheap-flights/${org}/${dst}?${p}`, "Ověřit u easyJet", "medium", "easyjet");
}

function pegasus(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    adultCount: String(i.adults ?? 1),
    childCount: "0",
    currency: i.currency ?? "EUR",
    departureDate: toDDMMYYYYSlash(i.departDate),
    destinationCode: i.destination,
    originCode: i.origin,
    returnDate: toDDMMYYYYSlash(i.returnDate),
  });
  return searchLink(`https://book.flypgs.com/en/round-trip?${p}`, "Ověřit u Pegasu", "medium", "pegasus");
}

function norwegian(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    D_City: i.origin, D_Date: i.departDate,
    R_City: i.destination, R_Date: i.returnDate,
    Type: "roundtrip",
    adult: String(i.adults ?? 1), child: "0", infant: "0", young: "0", senior: "0",
  });
  return searchLink(`https://www.norwegian.com/en/booking/flight/search/?${p}`, "Ověřit u Norwegian", "medium", "norwegian");
}

function eurowings(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    origin: i.origin, destination: i.destination,
    adult: String(i.adults ?? 1), departure: i.departDate,
    return: i.returnDate, cabinClass: "ECONOMY", trip: "roundtrip",
  });
  return searchLink(`https://www.eurowings.com/en/booking/flights/search.html?${p}`, "Ověřit u Eurowings", "low", "eurowings");
}

function vueling(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    origin: i.origin, destination: i.destination,
    departure: toDDMMYYYYSlash(i.departDate), arrival: toDDMMYYYYSlash(i.returnDate),
    adults: String(i.adults ?? 1), children: "0", infants: "0", trip: "R",
  });
  return searchLink(`https://www.vueling.com/en/book-tickets/search?${p}`, "Ověřit u Vueling", "low", "vueling");
}

function transavia(i: AirlineVerificationInput): AirlineVerificationLink {
  const dep = toDDMMYYYYRaw(i.departDate);
  const ret = toDDMMYYYYRaw(i.returnDate);
  const adults = i.adults ?? 1;
  return searchLink(
    `https://www.transavia.com/en-EU/book-flights/return/departure-${i.origin}/arrival-${i.destination}/date-${dep}/return-date-${ret}/passengers-${adults}-0-0/`,
    "Ověřit u Transavia", "low", "transavia",
  );
}

function sunexpress(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    from: i.origin, to: i.destination,
    departure: i.departDate, returndate: i.returnDate,
    adults: String(i.adults ?? 1), trip: "return",
  });
  return searchLink(`https://www.sunexpress.com/en/booking/flight-search/?${p}`, "Ověřit u SunExpress", "low", "sunexpress");
}

function airbaltic(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    origin: i.origin, destination: i.destination,
    departureDate: i.departDate, returnDate: i.returnDate,
    adult: String(i.adults ?? 1), child: "0", infant: "0", tripType: "RETURN",
  });
  return searchLink(`https://www.airbaltic.com/en/home?${p}`, "Ověřit u airBaltic", "low", "airbaltic");
}

function smartwings(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    from: i.origin, to: i.destination,
    dep: i.departDate, ret: i.returnDate, adt: String(i.adults ?? 1),
  });
  return searchLink(`https://booking.smartwings.com/?${p}`, "Ověřit u Smartwings", "low", "smartwings");
}

function condor(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    "s.depAPorts": i.origin, "s.arrAPorts": i.destination,
    "s.dep": toDDMMYYYYDot(i.departDate), "s.arr": toDDMMYYYYDot(i.returnDate),
    "s.pax.a": String(i.adults ?? 1),
  });
  return searchLink(`https://www.condor.com/en/flight-booking/flight-search.jsp?${p}`, "Ověřit u Condor", "low", "condor");
}

function ajet(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    from: i.origin, to: i.destination,
    date: i.departDate, returnDate: i.returnDate,
    adults: String(i.adults ?? 1), tripType: "RT",
  });
  return searchLink(`https://www.ajet.com/en/booking/search?${p}`, "Ověřit u AJet", "low", "ajet");
}

function volotea(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    origin: i.origin, destination: i.destination,
    departure: i.departDate, return: i.returnDate,
    adults: String(i.adults ?? 1), children: "0", infants: "0",
  });
  return searchLink(`https://www.volotea.com/en/flights/?${p}`, "Ověřit u Volotea", "low", "volotea");
}

function jet2(i: AirlineVerificationInput): AirlineVerificationLink {
  const p = new URLSearchParams({
    from: i.origin, to: i.destination,
    depart: toJet2Date(i.departDate), return: toJet2Date(i.returnDate),
    adults: String(i.adults ?? 1),
  });
  return searchLink(`https://www.jet2.com/cheapflights?${p}`, "Ověřit u Jet2", "low", "jet2");
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Builds the best available verification link for the given airline and route.
 *
 * Rules:
 *   - linkKind is never "exact" — we have no confirmed bookable offer IDs.
 *   - If validationStatus is "manual-broken", the search link is downgraded to homepage.
 *   - Airlines with stable known URL formats get "search" links.
 *   - Charter/tour-operator airlines with no reliable public booking URL get homepage.
 */
export function buildAirlineVerificationLink(input: AirlineVerificationInput): AirlineVerificationLink {
  try {
    // If we know this link is broken, skip straight to homepage
    const validation = AIRLINE_LINK_VALIDATION[input.airlineId];
    if (validation?.validationStatus === "manual-broken") {
      return homepageLink(input.airlineId);
    }

    switch (input.airlineId) {
      case "ryanair":    return ryanair(input);
      case "wizz":       return wizz(input);
      case "easyjet":    return easyjet(input);
      case "pegasus":    return pegasus(input);
      case "norwegian":  return norwegian(input);
      case "eurowings":  return eurowings(input);
      case "vueling":    return vueling(input);
      case "transavia":  return transavia(input);
      case "sunexpress": return sunexpress(input);
      case "airbaltic":  return airbaltic(input);
      case "smartwings": return smartwings(input);
      case "condor":     return condor(input);
      case "ajet":       return ajet(input);
      case "volotea":    return volotea(input);
      case "jet2":       return jet2(input);
      case "corendon":
      case "aircairo":
        return homepageLink(input.airlineId);
      default:
        return homepageLink(input.airlineId);
    }
  } catch {
    return homepageLink(input.airlineId);
  }
}
