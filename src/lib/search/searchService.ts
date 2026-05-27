import { MockTravelAdapter } from "./adapters/mockAdapter";
import { parseTravelWish } from "./parseTravelWish";
import { scoreItinerary } from "./scoring";
import type { ItineraryOption, SearchResponse, TravelSearchRequest } from "./types";

const adapters = [new MockTravelAdapter()];

function byScore(a: { score?: number }, b: { score?: number }) {
  return (b.score ?? 0) - (a.score ?? 0);
}

function isInDateRange(trip: ItineraryOption, request: TravelSearchRequest) {
  if (request.targetMonth && trip.month !== request.targetMonth) return false;
  if (request.dateFrom && trip.dates.depart < request.dateFrom) return false;
  if (request.dateTo && trip.dates.depart > request.dateTo) return false;
  return true;
}

function matchesDestinationMode(trip: ItineraryOption, request: TravelSearchRequest) {
  if (request.destinationMode === "any") return true;
  if (request.destinationMode === "warm") return trip.expectedTemperatureC >= (request.minTemperatureC ?? 18);
  return trip.destinationMode === request.destinationMode;
}

function matchesHardConstraints(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!request.origins.includes(trip.origin)) return false;
  if (!isInDateRange(trip, request)) return false;
  if (request.maxBudget && trip.totalPrice > request.maxBudget) return false;
  if (request.minNights && trip.nights < request.minNights) return false;
  if (request.maxNights && trip.nights > request.maxNights) return false;
  if (!matchesDestinationMode(trip, request)) return false;
  if (request.minTemperatureC && trip.expectedTemperatureC < request.minTemperatureC) return false;
  if (request.directOnly && !trip.direct) return false;
  if (request.weekendOnly && trip.weekendFit < 75) return false;
  return true;
}

function relaxationReasons(trip: ItineraryOption, request: TravelSearchRequest) {
  const reasons: string[] = [];
  if (!request.origins.includes(trip.origin)) reasons.push(`neodlétá z ${request.origins.join(" / ")}, ale z ${trip.origin}`);
  if (!isInDateRange(trip, request)) reasons.push("není v požadovaném termínu");
  if (request.maxBudget && trip.totalPrice > request.maxBudget) reasons.push("je nad zadaným rozpočtem");
  if (request.minNights && trip.nights < request.minNights) reasons.push("je kratší než požadovaná délka");
  if (request.maxNights && trip.nights > request.maxNights) reasons.push("je delší než požadovaná délka");
  if (!matchesDestinationMode(trip, request)) reasons.push("má jiný typ destinace");
  if (request.minTemperatureC && trip.expectedTemperatureC < request.minTemperatureC) reasons.push("má nižší očekávanou teplotu");
  if (request.directOnly && !trip.direct) reasons.push("obsahuje přestup");
  return reasons;
}

function relaxedCandidate(trip: ItineraryOption, request: TravelSearchRequest) {
  if (!isInDateRange(trip, request)) return false;
  if (!matchesDestinationMode(trip, request)) return false;
  if (request.minTemperatureC && trip.expectedTemperatureC < request.minTemperatureC - 3) return false;
  if (request.maxBudget && trip.totalPrice > request.maxBudget * 1.25) return false;
  if (request.minNights && trip.nights < Math.max(1, request.minNights - 1)) return false;
  if (request.maxNights && trip.nights > request.maxNights + 1) return false;
  return true;
}

function buildRelaxationMessages(request: TravelSearchRequest, relaxedResults: ItineraryOption[]) {
  if (relaxedResults.length === 0) return [];

  const messages = ["Nemáme přesnou shodu pro zadané podmínky."];
  if (request.origins.includes("PED") && relaxedResults.some((trip) => trip.origin !== "PED")) {
    messages.push("Pardubice zatím nemají v mock datech dostatek spojení.");
    messages.push("Zkusili jsme Prahu a Vídeň jako alternativní odlety.");
  }
  if (request.directOnly && relaxedResults.some((trip) => !trip.direct)) messages.push("Povolili jsme přestup.");
  const minTemperatureC = request.minTemperatureC;
  if (minTemperatureC !== undefined && relaxedResults.some((trip) => trip.expectedTemperatureC < minTemperatureC)) {
    messages.push("Rozšířili jsme teplotní limit.");
  }
  const maxBudget = request.maxBudget;
  if (maxBudget !== undefined && relaxedResults.some((trip) => trip.totalPrice > maxBudget)) {
    messages.push("Rozšířili jsme rozpočet pro nejbližší alternativy.");
  }
  return messages;
}

function featured(results: ItineraryOption[]) {
  return {
    bestValue: results[0],
    cheapest: [...results].sort((a, b) => a.totalPrice - b.totalPrice)[0],
    mostComfortable: [...results].sort((a, b) => (b.scoreBreakdown?.comfort ?? 0) - (a.scoreBreakdown?.comfort ?? 0))[0],
    bestWeekend: [...results].sort((a, b) => b.weekendFit - a.weekendFit)[0],
  };
}

export async function searchTrips(input: Partial<TravelSearchRequest> & { wish: string }): Promise<SearchResponse> {
  const parsedRequest = parseTravelWish(input.wish, input);
  const rawResults = (await Promise.all(adapters.map((adapter) => adapter.searchTrips(parsedRequest)))).flat();
  const exactResults = rawResults.filter((trip) => matchesHardConstraints(trip, parsedRequest)).map((trip) => scoreItinerary(trip, parsedRequest)).sort(byScore);
  const relaxedResults =
    exactResults.length > 0
      ? []
      : rawResults
          .filter((trip) => relaxedCandidate(trip, parsedRequest))
          .map((trip) => ({
            ...scoreItinerary(trip, parsedRequest),
            relaxationReasons: relaxationReasons(trip, parsedRequest),
          }))
          .filter((trip) => (trip.relaxationReasons?.length ?? 0) > 0)
          .sort(byScore)
          .slice(0, 5);

  return {
    parsedRequest,
    appliedFilters: parsedRequest,
    exactResults,
    relaxedResults,
    results: exactResults,
    assumptions: parsedRequest.assumptions ?? [],
    unsupportedConstraints: parsedRequest.unsupportedConstraints ?? [],
    relaxationMessages: buildRelaxationMessages(parsedRequest, relaxedResults),
    featured: featured(exactResults),
  };
}
