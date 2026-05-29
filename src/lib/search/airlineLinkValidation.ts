// Manual validation records for airline search URL patterns.
//
// HOW TO UPDATE:
//   1. Open the generated URL for the airline (visible in the "Další zdroje" section
//      when running with NODE_ENV=development).
//   2. Verify whether the page opens with prefilled route/date params.
//   3. Update the record below and set lastValidatedAt to today's date (YYYY-MM-DD).
//
// RULES:
//   - Never set manual-ok unless you personally opened the URL and saw prefilled results.
//   - If validationStatus is "manual-broken", the builder falls back to homepage.
//   - Do not run automated crawlers, headless browsers, or CAPTCHA bypass to test.

export type LinkValidationStatus =
  | "untested"        // not yet manually verified
  | "manual-ok"       // manually opened; prefilled search worked
  | "manual-broken"   // manually opened; page ignored params or broke
  | "auto-ok"         // lightweight HTTP probe returned 200 (no content check)
  | "auto-failed";    // probe returned non-200 or timed out

export type ValidationRecord = {
  validationStatus: LinkValidationStatus;
  lastValidatedAt?: string;   // YYYY-MM-DD
  validationNote?: string;
};

export const AIRLINE_LINK_VALIDATION: Record<string, ValidationRecord> = {
  ryanair: {
    validationStatus: "manual-ok",
    lastValidatedAt: "2025-01-15",
    validationNote: "trip/flights/select?originIata=... opens prefilled select-flights page with route and dates filled in.",
  },

  wizz: {
    validationStatus: "untested",
    validationNote:
      "Path format /en-gb/booking/select-flight/{org}/{dst}/{dep}/{ret}/... observed on site. May require active session cookie or redirect to homepage. Test manually.",
  },

  easyjet: {
    validationStatus: "untested",
    validationNote:
      "/en/cheap-flights/{org}/{dst}?departDate= format observed. Some routes may redirect to homepage. Test with PRG→BCN.",
  },

  pegasus: {
    validationStatus: "untested",
    validationNote:
      "book.flypgs.com/en/round-trip?originCode=...&departureDate=DD/MM/YYYY format. Date format is DD/MM/YYYY — verify that params are accepted.",
  },

  norwegian: {
    validationStatus: "untested",
    validationNote:
      "/en/booking/flight/search/?D_City=...&D_Date= format observed. Norwegian reduced its European network in 2022; verify route actually exists from origin.",
  },

  eurowings: {
    validationStatus: "untested",
    validationNote:
      "/en/booking/flights/search.html?origin=... Low confidence — Eurowings uses Angular SPA; query params may be ignored in favour of hash routing.",
  },

  vueling: {
    validationStatus: "untested",
    validationNote:
      "/en/book-tickets/search?origin=... format. Vueling SPA may not deep-link via query params; may require hash-based params. Test manually.",
  },

  transavia: {
    validationStatus: "untested",
    validationNote:
      "Path format /return/departure-{org}/arrival-{dst}/date-{DDMMYYYY}/... Transavia uses this path format in their booking UI — test whether path deep-link works.",
  },

  sunexpress: {
    validationStatus: "untested",
    validationNote:
      "/en/booking/flight-search/?from=...&trip=return format. SunExpress is seasonal; verify route exists from origin.",
  },

  airbaltic: {
    validationStatus: "untested",
    validationNote:
      "/en/home?origin=...&tripType=RETURN query format. airBaltic uses React SPA; params may or may not be read on initial load.",
  },

  smartwings: {
    validationStatus: "untested",
    validationNote:
      "booking.smartwings.com/?from=...&dep=... format. Smartwings uses a third-party booking engine; test whether query params are passed through.",
  },

  condor: {
    validationStatus: "untested",
    validationNote:
      "/en/flight-booking/flight-search.jsp?s.depAPorts=... format. Condor JSP-based search. Date format is DD.MM.YYYY. Test manually.",
  },

  ajet: {
    validationStatus: "untested",
    validationNote:
      "/en/booking/search?from=...&tripType=RT format. AJet (formerly AnadoluJet) rebranded; URL format may have changed. Test manually.",
  },

  volotea: {
    validationStatus: "untested",
    validationNote:
      "/en/flights/?origin=...&departure=YYYY-MM-DD format. Low confidence — Volotea is a small carrier with limited CZ routes.",
  },

  jet2: {
    validationStatus: "untested",
    validationNote:
      "/cheapflights?from=...&depart=DD-Mon-YYYY format (e.g. 01-Jul-2026). Jet2 has limited CZ presence; verify route exists.",
  },

  corendon: {
    validationStatus: "untested",
    validationNote: "Homepage only. Charter carrier — booking primarily through tour operators.",
  },

  aircairo: {
    validationStatus: "untested",
    validationNote: "Homepage only. Charter carrier — online booking limited.",
  },
};

// Czech-language tooltip text for each validation status.
export const VALIDATION_TOOLTIP: Record<LinkValidationStatus, string> = {
  "untested":      "Odkaz zatím netestovaný. Může vyžadovat ruční zadání trasy.",
  "manual-ok":     "Ručně ověřeno — odkaz otevírá předvyplněné vyhledávání.",
  "manual-broken": "Odkaz nefunguje správně — používáme záložní web aerolinky.",
  "auto-ok":       "Automatická sonda vrátila HTTP 200 (obsah neověřen).",
  "auto-failed":   "Automatická sonda selhala — použij záložní web aerolinky.",
};
