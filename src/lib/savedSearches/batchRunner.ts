import { type SearchResponse, type ItineraryOption } from "@/lib/search/types";
import {
  type SavedSearch,
  type SavedSearchRun,
  type SavedSearchRunComparison,
  recordRun,
  computeRunComparison,
  listSavedSearches,
} from "./storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BatchItemStatus = "waiting" | "running" | "done" | "failed";

export type BatchItemResult = {
  savedId: string;
  title: string;
  wish: string;
  status: BatchItemStatus;
  errorMessage?: string;
  run?: SavedSearchRun;
  comparison?: SavedSearchRunComparison;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Priority order for sourceConfidence when sorting results.
 * Lower number = higher priority.
 */
function sourceConfidencePriority(confidence: string | undefined): number {
  switch (confidence) {
    case "official":
      return 0;
    case "unofficial":
      return 1;
    case "cached":
      return 2;
    case "official-test":
      return 3;
    default:
      return 4;
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Selects the best priced result from a SearchResponse.
 *
 * Collects all results from exactResults and results, filters out non-priced
 * results, then sorts by: score desc → priceCzk asc → direct first →
 * sourceConfidence priority asc.
 */
export function selectBestPricedResult(
  response: SearchResponse
): ItineraryOption | undefined {
  const allResults: ItineraryOption[] = [
    ...(response.exactResults ?? []),
    ...(response.results ?? []),
  ];

  const pricedResults = allResults.filter(
    (r) =>
      r.provider !== "airline-search-link" &&
      r.sourceConfidence !== "search-only" &&
      r.isSandbox !== true &&
      r.availabilityStatus !== "mock" &&
      r.priceCzk !== undefined
  );

  if (pricedResults.length === 0) {
    return undefined;
  }

  const sorted = [...pricedResults].sort((a, b) => {
    // 1. Score descending
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    // 2. priceCzk ascending
    const priceA = a.priceCzk ?? Infinity;
    const priceB = b.priceCzk ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;

    // 3. Direct flights first
    const directA = a.direct ? 0 : 1;
    const directB = b.direct ? 0 : 1;
    if (directA !== directB) return directA - directB;

    // 4. sourceConfidence priority ascending
    return (
      sourceConfidencePriority(a.sourceConfidence) -
      sourceConfidencePriority(b.sourceConfidence)
    );
  });

  return sorted[0];
}

/**
 * Maps a WeatherConfidence value to a Czech human-readable label.
 */
function weatherConfidenceLabel(
  confidence: string | undefined
): string | undefined {
  switch (confidence) {
    case "forecast":
      return "předpověď";
    case "climate":
      return "klimatický odhad";
    case "unknown":
      return "počasí neznámé";
    default:
      return undefined;
  }
}

/**
 * Builds a SavedSearchRun record from a search response.
 */
export function buildSavedSearchRun(
  savedId: string,
  response: SearchResponse,
  runAt: string
): SavedSearchRun {
  const best = selectBestPricedResult(response);

  const allResults: ItineraryOption[] = [
    ...(response.exactResults ?? []),
    ...(response.results ?? []),
  ];

  const pricedResults = allResults.filter(
    (r) =>
      r.provider !== "airline-search-link" &&
      r.sourceConfidence !== "search-only" &&
      r.isSandbox !== true &&
      r.availabilityStatus !== "mock" &&
      r.priceCzk !== undefined
  );

  const searchOnlyCount = allResults.length - pricedResults.length;

  const id =
    savedId +
    "-r" +
    String(allResults.length) +
    "-p" +
    String(pricedResults.length);

  const bestDateRange =
    best != null
      ? `${best.dates.depart} – ${best.dates.return}`
      : undefined;

  return {
    id,
    runAt,
    bestPriceCzk: best?.priceCzk,
    bestTotalTripEstimateCzk: best?.totalTripEstimateCzk,
    bestDestination: best?.destination,
    bestDateRange,
    bestProvider: best?.provider,
    bestAirline: best?.airline,
    bestSourceConfidence: best?.sourceConfidence,
    bestTemperatureC: best?.expectedTemperatureC,
    bestWeatherConfidence: best?.weatherConfidence,
    ...(best !== undefined && {
      bestWeatherLabel: weatherConfidenceLabel(best.weatherConfidence),
    }),
    resultCount: allResults.length,
    pricedResultCount: pricedResults.length,
    searchOnlyResultCount: searchOnlyCount,
  } as SavedSearchRun & { bestWeatherLabel?: string };
}

/**
 * Runs a single saved search by calling the /api/search endpoint and records
 * the result in localStorage.
 */
export async function runSingleBatchSearch(
  search: SavedSearch
): Promise<BatchItemResult> {
  const { id: savedId, title, wish } = search;

  try {
    const httpResponse = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wish }),
    });

    if (!httpResponse.ok) {
      throw new Error("HTTP " + httpResponse.status);
    }

    const response = (await httpResponse.json()) as SearchResponse;

    const runAt = new Date().toISOString();
    const run = buildSavedSearchRun(savedId, response, runAt);

    const existingHistory =
      listSavedSearches().find((s) => s.id === savedId)?.priceHistory ?? [];

    const comparison = computeRunComparison(run, existingHistory);

    recordRun(savedId, run);

    return { savedId, title, wish, status: "done", run, comparison };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    return { savedId, title, wish, status: "failed", errorMessage };
  }
}
