import { getServerEnv, type ServerEnv } from "@/lib/config/env";
import { getDestinationModes } from "@/lib/search/destinations";
import { getProviderStatuses } from "@/lib/providers/status";
import { enrichWeather } from "@/lib/weather/openMeteoService";
import { DuffelAdapter } from "./adapters/duffelAdapter";
import { KiwiAdapter } from "./adapters/kiwiAdapter";
import { MockTravelAdapter } from "./adapters/mockAdapter";
import { RyanairDeepLinkAdapter } from "./adapters/ryanairDeepLinkAdapter";
import { RyanairUnofficialAdapter } from "./adapters/ryanairUnofficialAdapter";
import { SearchOnlyAirlineAdapter } from "./adapters/searchOnlyAirlineAdapter";
import { SkyscannerIndicativeAdapter } from "./adapters/skyscannerIndicativeAdapter";
import { SkyscannerLiveAdapter } from "./adapters/skyscannerLiveAdapter";
import { errorProviderResult, type TravelSourceAdapter } from "./adapters/baseAdapter";
import { parseTravelWish } from "./parseTravelWish";
import { normalizeCurrency, postProcessResults } from "./postProcessResults";
import { buildProviderLink } from "./providerLinks";
import { scoreItinerary } from "./scoring";
import { estimateTripTotalCost } from "@/lib/search/tripCost";
import type { ItineraryOption, LinkType, ProviderRunStatus, ProviderSearchResult, SearchResponse, TravelSearchRequest } from "./types";

const providerTimeoutMs = 8000;

const unconfiguredProviderWarnings: Partial<Record<TravelSourceAdapter["name"], string>> = {
  "skyscanner-live": "Skyscanner není nakonfigurovaný. Přidej SKYSCANNER_API_KEY do .env.local.",
  "skyscanner-indicative": "Skyscanner není nakonfigurovaný. Přidej SKYSCANNER_API_KEY do .env.local.",
  duffel: "Duffel není nakonfigurovaný. Přidej DUFFEL_ACCESS_TOKEN do .env.local.",
  kiwi: "Kiwi/Tequila není nakonfigurované. Přidej KIWI_API_KEY nebo TEQUILA_API_KEY do .env.local a restartuj dev server.",
  "ryanair-unofficial": "Neoficiální Ryanair zdroj je vypnutý. Nastav ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true pro osobní použití.",
};

// Provider priority for personal low-cost trip hunting:
//   1. Personal/unofficial low-cost sources (ryanair-unofficial) — highest discovery value
//   2. Deep-link search helpers (ryanair-deeplink)
//   3. Verified commercial APIs (duffel live, kiwi, skyscanner)
//   4. Development/test sources (duffel test, mock) — excluded from primary by default
function buildAdapters(env: ServerEnv): TravelSourceAdapter[] {
  const adapters: TravelSourceAdapter[] = [
    // Personal low-cost providers first
    new RyanairUnofficialAdapter(env),
    new RyanairDeepLinkAdapter(),
    // Commercial APIs
    new KiwiAdapter(env),
    new SkyscannerLiveAdapter(env),
    new SkyscannerIndicativeAdapter(env),
    new DuffelAdapter(env),
  ];

  if (env.enableMockProvider) adapters.push(new MockTravelAdapter());
  // Search-only adapter runs last; its results are separated before scoring
  adapters.push(new SearchOnlyAirlineAdapter(env.enableAirlineSearchLinks));
  return adapters;
}

function byScore(a: { score?: number }, b: { score?: number }) {
  return (b.score ?? 0) - (a.score ?? 0);
}

function byPrice(a: ItineraryOption, b: ItineraryOption) {
  const pa = a.priceCzk ?? a.totalPrice ?? Number.MAX_SAFE_INTEGER;
  const pb = b.priceCzk ?? b.totalPrice ?? Number.MAX_SAFE_INTEGER;
  return pa - pb;
}

function isInDateRange(trip: ItineraryOption, request: TravelSearchRequest) {
  if (request.targetMonth && trip.month !== request.targetMonth) return false;
  if (request.dateFrom && trip.dates.depart < request.dateFrom) return false;
  if (request.dateTo && trip.dates.depart > request.dateTo) return false;
  return true;
}

function matchesDestinationMode(trip: ItineraryOption, request: TravelSearchRequest) {
  if (request.destinationMode === "any") return true;

  // Use the registry as the authoritative source — never trust the adapter-assigned trip.destinationMode
  const registeredModes = getDestinationModes(trip.destinationAirportCode);

  if (request.destinationMode === "warm") {
    // For unknown destinations, fall back to temperature check only
    if (registeredModes.length > 0 && !registeredModes.includes("warm") && !registeredModes.includes("sea")) {
      return false; // known non-warm/non-sea destination
    }
    return (trip.expectedTemperatureC ?? 0) >= (request.minTemperatureC ?? 18);
  }

  // For unknown destinations (not in registry): reject from sea/cityBreak exact matches
  if (registeredModes.length === 0) return false;

  return registeredModes.includes(request.destinationMode);
}

function withinBudget(trip: ItineraryOption, request: TravelSearchRequest): boolean {
  if (request.maxBudget === undefined) return true;
  if ((request.budgetType ?? "flight") === "total") {
    if (trip.totalTripEstimateCzk === undefined) return true; // estimate missing → keep
    return trip.totalTripEstimateCzk <= request.maxBudget;
  }
  // flight budget
  if (trip.priceCzk === undefined) return false; // unknown currency → strict
  return trip.priceCzk <= request.maxBudget;
}

// Checks all hard constraints except destination mode — used to identify off-topic cheap results.
function matchesExceptDestinationMode(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!request.origins.includes(trip.origin)) return false;
  if (!isInDateRange(trip, request)) return false;
  if (!withinBudget(trip, request)) return false;
  if (request.minNights && trip.nights < request.minNights) return false;
  if (request.maxNights && trip.nights > request.maxNights) return false;
  if (request.directOnly && !trip.direct) return false;
  if (request.weekendOnly && trip.weekendFit < 75) return false;
  return true;
}

function matchesHardConstraints(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!request.origins.includes(trip.origin)) return false;
  if (!isInDateRange(trip, request)) return false;
  if (!withinBudget(trip, request)) return false;
  if (request.minNights && trip.nights < request.minNights) return false;
  if (request.maxNights && trip.nights > request.maxNights) return false;
  if (!matchesDestinationMode(trip, request)) return false;
  if (request.minTemperatureC && (trip.expectedTemperatureC ?? 0) < request.minTemperatureC) return false;
  if (request.directOnly && !trip.direct) return false;
  if (request.weekendOnly && trip.weekendFit < 75) return false;
  return true;
}

function relaxationReasons(trip: ItineraryOption, request: TravelSearchRequest) {
  const reasons: string[] = [];
  if (!request.origins.includes(trip.origin)) reasons.push(`neodlétá z ${request.origins.join(" / ")}, ale z ${trip.origin}`);
  if (!isInDateRange(trip, request)) reasons.push("není v požadovaném termínu");
  if (!withinBudget(trip, request)) reasons.push("nemá potvrzenou cenu v rozpočtu");
  if (request.minNights && trip.nights < request.minNights) reasons.push("je kratší než požadovaná délka");
  if (request.maxNights && trip.nights > request.maxNights) reasons.push("je delší než požadovaná délka");
  if (!matchesDestinationMode(trip, request)) reasons.push("má jiný typ destinace");
  if (request.minTemperatureC && (trip.expectedTemperatureC ?? 0) < request.minTemperatureC) reasons.push("má nižší očekávanou teplotu");
  if (request.directOnly && !trip.direct) reasons.push("obsahuje přestup");
  return reasons;
}

function relaxedBudgetOk(trip: ItineraryOption, request: TravelSearchRequest): boolean {
  if (request.maxBudget === undefined) return true;
  const relaxedLimit = request.maxBudget * 1.25;
  if ((request.budgetType ?? "flight") === "total") {
    if (trip.totalTripEstimateCzk === undefined) return true;
    return trip.totalTripEstimateCzk <= relaxedLimit;
  }
  const price = trip.priceCzk ?? trip.totalPrice;
  if (price === undefined) return true;
  return price <= relaxedLimit;
}

function relaxedCandidate(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!isInDateRange(trip, request)) return false;
  if (!matchesDestinationMode(trip, request)) return false;
  if (request.minTemperatureC && (trip.expectedTemperatureC ?? 0) < request.minTemperatureC - 3) return false;
  if (!relaxedBudgetOk(trip, request)) return false;
  if (request.minNights && trip.nights < Math.max(1, request.minNights - 1)) return false;
  if (request.maxNights && trip.nights > request.maxNights + 1) return false;
  return true;
}

function buildRelaxationMessages(request: TravelSearchRequest, relaxedResults: ItineraryOption[]) {
  if (relaxedResults.length === 0) return [];

  const messages = ["Nemáme přesnou shodu pro zadané podmínky."];
  if (request.origins.includes("PED") && relaxedResults.some((trip) => trip.origin !== "PED")) {
    messages.push("Pardubice zatím nemají v dostupných datech dostatek spojení.");
    messages.push("Zkusili jsme Prahu a Vídeň jako alternativní odlety.");
  }
  if (request.directOnly && relaxedResults.some((trip) => !trip.direct)) messages.push("Povolili jsme přestup.");
  if (request.minTemperatureC !== undefined && relaxedResults.some((trip) => (trip.expectedTemperatureC ?? 0) < request.minTemperatureC!)) {
    messages.push("Rozšířili jsme teplotní limit.");
  }
  if (request.maxBudget !== undefined) {
    const overBudget = relaxedResults.some((trip) => !withinBudget(trip, request));
    if (overBudget) messages.push("Rozšířili jsme rozpočet pro nejbližší alternativy.");
  }
  return messages;
}

function featured(results: ItineraryOption[]) {
  return {
    bestValue: results[0],
    cheapest: [...results].sort(byPrice)[0],
    mostComfortable: [...results].sort((a, b) => (b.scoreBreakdown?.comfort ?? 0) - (a.scoreBreakdown?.comfort ?? 0))[0],
    bestWeekend: [...results].sort((a, b) => b.weekendFit - a.weekendFit)[0],
  };
}

function availabilityNoteFor(trip: ItineraryOption, linkType: LinkType) {
  if (trip.availabilityNote) return trip.availabilityNote;
  if (trip.availabilityStatus === "verified") return "Ověřená dostupná nabídka z poskytovatele.";
  if (trip.availabilityStatus === "indicative") return "Orientační cena z cache. Dostupnost ověř u zdroje.";
  if (linkType === "search" || trip.availabilityStatus === "search") return "Otevře se vyhledávání u dopravce. Dostupnost konkrétního dne nemusí být garantovaná.";
  if (trip.availabilityStatus === "mock") return "Demo výsledek z MVP dat. Cenu a dostupnost ověř u dopravce.";
  return "Zdroj zatím neumí přesný odkaz.";
}

function normalizeProviderLink(trip: ItineraryOption): ItineraryOption {
  const providerLink = buildProviderLink(trip);
  const linkType = trip.linkType ?? providerLink.linkType;
  const deepLink = trip.deepLink ?? providerLink.url;

  return {
    ...trip,
    deepLink,
    sourceUrl: deepLink,
    linkType,
    linkNote: trip.linkNote ?? providerLink.linkNote,
    availabilityNote: availabilityNoteFor(trip, linkType),
  };
}

function dedupeItineraries(results: ItineraryOption[]) {
  const byKey = new Map<string, ItineraryOption>();

  for (const result of results) {
    const key = [result.origin, result.destinationAirportCode, result.dates.depart, result.dates.return, result.providerResultId ?? result.id].join("|");
    const existing = byKey.get(key);
    if (!existing || (result.availabilityStatus === "verified" && existing.availabilityStatus !== "verified")) {
      byKey.set(key, result);
    }
  }

  return [...byKey.values()];
}

function timeoutMsForAdapter(adapter: TravelSourceAdapter, env: ServerEnv) {
  return adapter.name === "ryanair-unofficial" ? env.ryanairUnofficialTimeoutMs : providerTimeoutMs;
}

async function runAdapter(adapter: TravelSourceAdapter, request: TravelSearchRequest, env: ServerEnv): Promise<ProviderSearchResult> {
  const startedAt = Date.now();
  try {
    if (!adapter.isConfigured()) {
      return {
        provider: adapter.name,
        status: "skipped",
        results: [],
        warnings: [unconfiguredProviderWarnings[adapter.name] ?? `${adapter.name} is not configured.`],
        durationMs: Date.now() - startedAt,
      };
    }

    const timeoutMs = timeoutMsForAdapter(adapter, env);
    const timeout = new Promise<ProviderSearchResult>((resolve) => {
      setTimeout(
        () =>
          resolve({
            provider: adapter.name,
            status: "timeout",
            results: [],
            warnings: [
              adapter.name === "ryanair-unofficial"
                ? `Ryanair nestihl odpovědět do ${Math.round(timeoutMs / 1000)} s. Zobrazujeme ostatní zdroje.`
                : `${adapter.name} timed out after ${timeoutMs} ms.`,
            ],
            errorMessage: "Provider timeout",
            durationMs: Date.now() - startedAt,
            timeoutCount: adapter.name === "ryanair-unofficial" ? 1 : undefined,
          }),
        timeoutMs,
      );
    });

    const result = await Promise.race([adapter.searchTrips(request), timeout]);
    return {
      ...result,
      durationMs: result.durationMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ...errorProviderResult(adapter.name, error),
      durationMs: Date.now() - startedAt,
    };
  }
}

export async function searchTrips(input: Partial<TravelSearchRequest> & { wish: string }): Promise<SearchResponse> {
  const env = getServerEnv();
  const parsedRequest = parseTravelWish(input.wish, input);
  const adapterResults = await Promise.all(buildAdapters(env).map((adapter) => runAdapter(adapter, parsedRequest, env)));
  const providerWarnings = adapterResults.flatMap((result) => result.warnings.map((warning) => `${result.provider}: ${warning}`));
  const providerRunStatuses: ProviderRunStatus[] = adapterResults.map((result) => ({
    provider: result.provider,
    status: result.status,
    durationMs: result.durationMs ?? 0,
    resultCount: result.results.length,
    warningCount: result.warnings.length,
    errorMessage: result.errorMessage,
    requestCount: result.requestCount,
    timeoutCount: result.timeoutCount,
  }));
  const providerStatuses = getProviderStatuses();
  const statusByName = new Map(providerStatuses.map((provider) => [provider.name, provider] as const));
  const noActiveFlightProviders =
    !statusByName.get("skyscanner-live")?.enabled &&
    !statusByName.get("skyscanner-indicative")?.enabled &&
    !statusByName.get("duffel")?.enabled &&
    !statusByName.get("kiwi")?.enabled &&
    !statusByName.get("ryanair-unofficial")?.enabled &&
    !statusByName.get("mock")?.enabled;

  // Separate search-only results before any scoring — they have no price and
  // must not enter the main recommendation pipeline.
  const allAdapterResults = adapterResults.flatMap((result) => result.results);
  const searchOnlyResults = allAdapterResults.filter((t) => t.provider === "airline-search-link");
  const pricedAdapterResults = allAdapterResults.filter((t) => t.provider !== "airline-search-link");

  // Currency normalization happens before scoring so price scoring uses CZK
  const rawResults = dedupeItineraries(pricedAdapterResults.map(normalizeProviderLink));
  const withCurrency = rawResults.map(normalizeCurrency);
  const enrichedResults = await Promise.all(withCurrency.map((trip) => enrichWeather(trip)));

  // Compute trip cost estimates for all results before scoring so that the
  // score function and any downstream UI can use totalTripEstimateCzk.
  const withTripCost = enrichedResults.map((trip) => {
    const estimate = estimateTripTotalCost(trip);
    return {
      ...trip,
      tripCostEstimate: estimate,
      totalTripEstimateCzk: estimate.totalEstimateCzk,
    };
  });

  const scoredResults = withTripCost.map((trip) => scoreItinerary(trip, parsedRequest)).sort(byScore);

  // Weather diagnostics — computed after scoring so we can inspect all enriched results.
  const weatherDiagnostics = {
    enrichedCount: scoredResults.filter((t) => t.weatherConfidence !== "unknown").length,
    forecastCount: scoredResults.filter((t) => t.weatherConfidence === "forecast").length,
    climateCount: scoredResults.filter((t) => t.weatherConfidence === "climate").length,
    unknownCount: scoredResults.filter((t) => t.weatherConfidence === "unknown").length,
    tempPenaltyCount: scoredResults.filter((t) => (t.expectedTemperatureC ?? Infinity) < (parsedRequest.minTemperatureC ?? Infinity)).length,
    rainPenaltyCount: scoredResults.filter(
      (t) => (t.expectedPrecipitationMmPerDay ?? 0) > 4 && parsedRequest.weatherPreference === "no-rain",
    ).length,
  };

  // Trip cost diagnostics — how many results have a resolved total estimate.
  const tripCostDiagnostics = {
    estimatedCount: scoredResults.filter((t) => t.totalTripEstimateCzk !== undefined).length,
  };

  // Destination diagnostics — computed on all scored results.
  const timeToHour = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
  const earlyDepartureCount = scoredResults.filter((t) => timeToHour(t.departureTime) < 6).length;
  const destinationDiagnostics = {
    intent: parsedRequest.destinationMode,
    exactMatchCount: 0, // filled after primaryResults is resolved
    offTopicCount: 0,   // filled after offTopicResults is resolved
    unknownDestinationCount: scoredResults.filter((t) => getDestinationModes(t.destinationAirportCode).length === 0).length,
    mismatchCount: parsedRequest.destinationMode !== "any"
      ? scoredResults.filter((t) => {
          const modes = getDestinationModes(t.destinationAirportCode);
          return modes.length > 0 && !modes.includes(parsedRequest.destinationMode);
        }).length
      : 0,
  };

  // Separate sandbox results (Duffel test mode) from real candidates.
  // When showDuffelTestResults is false (default), sandbox results are excluded from
  // primary recommendations and placed in a separate section so they never mix with
  // real Ryanair / Kiwi candidates.
  const sandboxResults = scoredResults.filter((t) => t.isSandbox);
  const realResults = env.showDuffelTestResults ? scoredResults : scoredResults.filter((t) => !t.isSandbox);

  const exactResults = realResults.filter((trip) => trip.availabilityStatus === "verified" && matchesHardConstraints(trip, parsedRequest));
  const indicativeResults = realResults.filter((trip) => trip.availabilityStatus === "indicative" && matchesHardConstraints(trip, parsedRequest));
  const demoOrSearchResults = realResults.filter((trip) => !["verified", "indicative"].includes(trip.availabilityStatus) && matchesHardConstraints(trip, parsedRequest));
  const primaryCandidates = exactResults.length > 0 ? exactResults : indicativeResults.length > 0 ? indicativeResults : demoOrSearchResults;

  // Post-processing: dedup similar offers, remove dominated, limit result count
  let primaryResults: ItineraryOption[];
  let diagnostics: ReturnType<typeof postProcessResults>["diagnostics"] | undefined;
  try {
    const processed = postProcessResults(primaryCandidates, parsedRequest);
    primaryResults = processed.results;
    diagnostics = processed.diagnostics;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[searchService] postProcessResults threw unexpectedly:", err);
    }
    // Fall back to unprocessed candidates so the search still returns results
    primaryResults = primaryCandidates.slice(0, 12);
    diagnostics = undefined;
  }

  const relaxedResults =
    primaryResults.length > 0
      ? []
      : realResults
          .filter((trip) => relaxedCandidate(trip, parsedRequest))
          .map((trip) => ({
            ...trip,
            relaxationReasons: relaxationReasons(trip, parsedRequest),
          }))
          .filter((trip) => (trip.relaxationReasons?.length ?? 0) > 0)
          .sort(byScore)
          .slice(0, 5);

  // Off-topic results: match budget/dates/origin/length but NOT destination mode.
  // Only meaningful when user expressed a specific destination intent.
  const offTopicResults =
    parsedRequest.destinationMode !== "any"
      ? realResults
          .filter((trip) => !matchesHardConstraints(trip, parsedRequest) && matchesExceptDestinationMode(trip, parsedRequest))
          .sort(byPrice)
          .slice(0, 6)
      : [];

  // Ryanair unofficial diagnostics
  const ryanairScored = scoredResults.filter((t) => t.provider === "ryanair-unofficial");
  const ryanairDiagnostics = {
    resultCount: ryanairScored.length,
    withVerificationUrl: ryanairScored.filter((t) => t.sourceUrl.includes("select?")).length,
    earlyDepartureCount: ryanairScored.filter((t) => {
      const [h] = t.departureTime.split(":").map(Number);
      return h < 6;
    }).length,
    offTopicCount: offTopicResults.filter((t) => t.provider === "ryanair-unofficial").length,
    requestCount: providerRunStatuses.find((p) => p.provider === "ryanair-unofficial")?.requestCount ?? 0,
    timeoutCount: providerRunStatuses.find((p) => p.provider === "ryanair-unofficial")?.timeoutCount ?? 0,
  };

  const searchDiagnostics = {
    pricedResultCount: pricedAdapterResults.filter((t) => t.priceCzk !== undefined || t.totalPrice !== undefined).length,
    searchOnlyCandidateCount: searchOnlyResults.length,
    finalDisplayedResultCount: primaryResults.length,
  };

  return {
    parsedRequest,
    appliedFilters: parsedRequest,
    exactResults: primaryResults,
    indicativeResults,
    relaxedResults,
    results: primaryResults,
    noActiveFlightProviders,
    providerStatuses,
    providerRunStatuses,
    providerWarnings,
    assumptions: parsedRequest.assumptions ?? [],
    unsupportedConstraints: parsedRequest.unsupportedConstraints ?? [],
    relaxationMessages: buildRelaxationMessages(parsedRequest, relaxedResults),
    featured: featured(primaryResults),
    postProcessDiagnostics: diagnostics,
    sandboxResults,
    searchOnlyResults,
    offTopicResults,
    weatherDiagnostics,
    tripCostDiagnostics,
    destinationDiagnostics: {
      ...destinationDiagnostics,
      exactMatchCount: primaryResults.length,
      offTopicCount: offTopicResults.length,
    },
    earlyDepartureCount,
    ryanairDiagnostics,
    searchDiagnostics,
  };
}
