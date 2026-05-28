import { getServerEnv } from "@/lib/config/env";
import { getProviderStatuses } from "@/lib/providers/status";
import { enrichWeather } from "@/lib/weather/openMeteoService";
import { DuffelAdapter } from "./adapters/duffelAdapter";
import { KiwiAdapter } from "./adapters/kiwiAdapter";
import { MockTravelAdapter } from "./adapters/mockAdapter";
import { RyanairDeepLinkAdapter } from "./adapters/ryanairDeepLinkAdapter";
import { SkyscannerIndicativeAdapter } from "./adapters/skyscannerIndicativeAdapter";
import { SkyscannerLiveAdapter } from "./adapters/skyscannerLiveAdapter";
import { errorProviderResult, type TravelSourceAdapter } from "./adapters/baseAdapter";
import { parseTravelWish } from "./parseTravelWish";
import { normalizeCurrency, postProcessResults } from "./postProcessResults";
import { buildProviderLink } from "./providerLinks";
import { scoreItinerary } from "./scoring";
import type { ItineraryOption, LinkType, ProviderSearchResult, SearchResponse, TravelSearchRequest } from "./types";

const providerTimeoutMs = 8000;

const unconfiguredProviderWarnings: Partial<Record<TravelSourceAdapter["name"], string>> = {
  "skyscanner-live": "Skyscanner není nakonfigurovaný. Přidej SKYSCANNER_API_KEY do .env.local.",
  "skyscanner-indicative": "Skyscanner není nakonfigurovaný. Přidej SKYSCANNER_API_KEY do .env.local.",
  duffel: "Duffel není nakonfigurovaný. Přidej DUFFEL_ACCESS_TOKEN do .env.local.",
  kiwi: "Kiwi/Tequila není nakonfigurované. Přidej KIWI_API_KEY nebo TEQUILA_API_KEY do .env.local a restartuj dev server.",
};

function buildAdapters(): TravelSourceAdapter[] {
  const env = getServerEnv();
  const adapters: TravelSourceAdapter[] = [
    new SkyscannerLiveAdapter(env),
    new SkyscannerIndicativeAdapter(env),
    new DuffelAdapter(env),
    new KiwiAdapter(env),
    new RyanairDeepLinkAdapter(),
  ];

  if (env.enableMockProvider) adapters.push(new MockTravelAdapter());
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
  if (request.destinationMode === "warm") return (trip.expectedTemperatureC ?? 0) >= (request.minTemperatureC ?? 18);
  return trip.destinationMode === request.destinationMode;
}

function matchesHardConstraints(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!request.origins.includes(trip.origin)) return false;
  if (!isInDateRange(trip, request)) return false;
  if (request.maxBudget !== undefined) {
    if (trip.priceCzk === undefined) return false; // unknown currency → strict
    if (trip.priceCzk > request.maxBudget) return false;
  }
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
  if (request.maxBudget !== undefined) {
    const price = trip.priceCzk ?? trip.totalPrice;
    if (price !== undefined && price > request.maxBudget) reasons.push("nemá potvrzenou cenu v rozpočtu");
  }
  if (request.minNights && trip.nights < request.minNights) reasons.push("je kratší než požadovaná délka");
  if (request.maxNights && trip.nights > request.maxNights) reasons.push("je delší než požadovaná délka");
  if (!matchesDestinationMode(trip, request)) reasons.push("má jiný typ destinace");
  if (request.minTemperatureC && (trip.expectedTemperatureC ?? 0) < request.minTemperatureC) reasons.push("má nižší očekávanou teplotu");
  if (request.directOnly && !trip.direct) reasons.push("obsahuje přestup");
  return reasons;
}

function relaxedCandidate(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!isInDateRange(trip, request)) return false;
  if (!matchesDestinationMode(trip, request)) return false;
  if (request.minTemperatureC && (trip.expectedTemperatureC ?? 0) < request.minTemperatureC - 3) return false;
  if (request.maxBudget !== undefined) {
    const price = trip.priceCzk ?? trip.totalPrice;
    if (price !== undefined && price > request.maxBudget * 1.25) return false;
  }
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
    const overBudget = relaxedResults.some((trip) => {
      const price = trip.priceCzk ?? trip.totalPrice;
      return price !== undefined && price > request.maxBudget!;
    });
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

async function runAdapter(adapter: TravelSourceAdapter, request: TravelSearchRequest): Promise<ProviderSearchResult> {
  try {
    if (!adapter.isConfigured()) {
      return {
        provider: adapter.name,
        status: "skipped",
        results: [],
        warnings: [unconfiguredProviderWarnings[adapter.name] ?? `${adapter.name} is not configured.`],
      };
    }

    const timeout = new Promise<ProviderSearchResult>((resolve) => {
      setTimeout(
        () =>
          resolve({
            provider: adapter.name,
            status: "error",
            results: [],
            warnings: [`${adapter.name} timed out after ${providerTimeoutMs} ms.`],
            errorMessage: "Provider timeout",
          }),
        providerTimeoutMs,
      );
    });

    return await Promise.race([adapter.searchTrips(request), timeout]);
  } catch (error) {
    return errorProviderResult(adapter.name, error);
  }
}

export async function searchTrips(input: Partial<TravelSearchRequest> & { wish: string }): Promise<SearchResponse> {
  const parsedRequest = parseTravelWish(input.wish, input);
  const adapterResults = await Promise.all(buildAdapters().map((adapter) => runAdapter(adapter, parsedRequest)));
  const providerWarnings = adapterResults.flatMap((result) => result.warnings.map((warning) => `${result.provider}: ${warning}`));
  const providerStatuses = getProviderStatuses();
  const statusByName = new Map(providerStatuses.map((provider) => [provider.name, provider] as const));
  const noActiveFlightProviders =
    !statusByName.get("skyscanner-live")?.enabled &&
    !statusByName.get("skyscanner-indicative")?.enabled &&
    !statusByName.get("duffel")?.enabled &&
    !statusByName.get("kiwi")?.enabled &&
    !statusByName.get("mock")?.enabled;

  // Currency normalization happens before scoring so price scoring uses CZK
  const rawResults = dedupeItineraries(adapterResults.flatMap((result) => result.results).map(normalizeProviderLink));
  const withCurrency = rawResults.map(normalizeCurrency);
  const enrichedResults = await Promise.all(withCurrency.map((trip) => enrichWeather(trip)));
  const scoredResults = enrichedResults.map((trip) => scoreItinerary(trip, parsedRequest)).sort(byScore);

  const exactResults = scoredResults.filter((trip) => trip.availabilityStatus === "verified" && matchesHardConstraints(trip, parsedRequest));
  const indicativeResults = scoredResults.filter((trip) => trip.availabilityStatus === "indicative" && matchesHardConstraints(trip, parsedRequest));
  const demoOrSearchResults = scoredResults.filter((trip) => !["verified", "indicative"].includes(trip.availabilityStatus) && matchesHardConstraints(trip, parsedRequest));
  const primaryCandidates = exactResults.length > 0 ? exactResults : indicativeResults.length > 0 ? indicativeResults : demoOrSearchResults;

  // Post-processing: dedup similar offers, remove dominated, limit result count
  const { results: primaryResults, diagnostics } = postProcessResults(primaryCandidates, parsedRequest);

  const relaxedResults =
    primaryResults.length > 0
      ? []
      : scoredResults
          .filter((trip) => relaxedCandidate(trip, parsedRequest))
          .map((trip) => ({
            ...trip,
            relaxationReasons: relaxationReasons(trip, parsedRequest),
          }))
          .filter((trip) => (trip.relaxationReasons?.length ?? 0) > 0)
          .sort(byScore)
          .slice(0, 5);

  return {
    parsedRequest,
    appliedFilters: parsedRequest,
    exactResults: primaryResults,
    indicativeResults,
    relaxedResults,
    results: primaryResults,
    noActiveFlightProviders,
    providerStatuses,
    providerWarnings,
    assumptions: parsedRequest.assumptions ?? [],
    unsupportedConstraints: parsedRequest.unsupportedConstraints ?? [],
    relaxationMessages: buildRelaxationMessages(parsedRequest, relaxedResults),
    featured: featured(primaryResults),
    postProcessDiagnostics: diagnostics,
  };
}
