import type { ItineraryOption, PostProcessDiagnostics, TravelSearchRequest } from "./types";

// ── Currency normalization ────────────────────────────────────────────────────

const exchangeRates: Record<string, number> = {
  CZK: 1,
  EUR: 25,
  USD: 23,
  GBP: 29,
};

export function normalizeCurrency(trip: ItineraryOption): ItineraryOption {
  if (trip.totalPrice === undefined || trip.currency === undefined) return trip;
  const rate = exchangeRates[trip.currency];
  if (rate === undefined) return trip; // priceCzk stays undefined
  return { ...trip, priceCzk: Math.round(trip.totalPrice * rate) };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function hourOf(time: string): string {
  return time.slice(0, 2); // "HH"
}

function dedupKey(trip: ItineraryOption): string {
  const stops = trip.outboundSegments.length + trip.inboundSegments.length;
  const carrier = trip.airline.toLowerCase().slice(0, 8);
  return [
    trip.origin,
    trip.destinationAirportCode,
    trip.dates.depart,
    trip.dates.return,
    hourOf(trip.departureTime),
    hourOf(trip.returnTime),
    carrier,
    stops,
  ].join("|");
}

function deduplicateSimilar(results: ItineraryOption[]): ItineraryOption[] {
  const groups = new Map<string, ItineraryOption[]>();
  for (const trip of results) {
    const key = dedupKey(trip);
    const group = groups.get(key) ?? [];
    group.push(trip);
    groups.set(key, group);
  }

  const kept: ItineraryOption[] = [];
  for (const group of groups.values()) {
    const best = group.slice().sort((a, b) => {
      const pa = a.priceCzk ?? a.totalPrice ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priceCzk ?? b.totalPrice ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return (b.score ?? 0) - (a.score ?? 0);
    })[0];
    kept.push(best);
  }
  return kept;
}

// ── Dominated-offer removal ───────────────────────────────────────────────────

function removeDominated(results: ItineraryOption[]): ItineraryOption[] {
  const dominated = new Set<string>();

  for (const a of results) {
    if (dominated.has(a.id)) continue;
    for (const b of results) {
      if (a.id === b.id || dominated.has(b.id)) continue;
      if (
        a.origin !== b.origin ||
        a.destinationAirportCode !== b.destinationAirportCode ||
        a.dates.depart !== b.dates.depart ||
        a.dates.return !== b.dates.return
      ) {
        continue;
      }
      const pa = a.priceCzk ?? a.totalPrice ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priceCzk ?? b.totalPrice ?? Number.MAX_SAFE_INTEGER;
      const stopsA = a.direct ? 0 : 1;
      const stopsB = b.direct ? 0 : 1;
      // A dominates B: same or better on both dimensions, strictly better on at least one
      if (pa <= pb && stopsA <= stopsB && (pa < pb || stopsA < stopsB)) {
        dominated.add(b.id);
      }
    }
  }

  return results.filter((r) => !dominated.has(r.id));
}

// ── Result limiting ───────────────────────────────────────────────────────────

function limitResults(results: ItineraryOption[], maxTotal = 12, maxPerDest = 3): ItineraryOption[] {
  const countByDest = new Map<string, number>();
  const limited: ItineraryOption[] = [];
  for (const trip of results) {
    if (limited.length >= maxTotal) break;
    const count = countByDest.get(trip.destinationAirportCode) ?? 0;
    if (count >= maxPerDest) continue;
    countByDest.set(trip.destinationAirportCode, count + 1);
    limited.push(trip);
  }
  return limited;
}

// ── Scoring-aware sort ────────────────────────────────────────────────────────

function sortResults(results: ItineraryOption[]): ItineraryOption[] {
  return results.slice().sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (Math.abs(scoreDiff) > 2) return scoreDiff;
    const pa = a.priceCzk ?? a.totalPrice ?? Number.MAX_SAFE_INTEGER;
    const pb = b.priceCzk ?? b.totalPrice ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    const stopsA = a.direct ? 0 : 1;
    const stopsB = b.direct ? 0 : 1;
    return stopsA - stopsB;
  });
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export function postProcessResults(
  results: ItineraryOption[],
  request: TravelSearchRequest,
): { results: ItineraryOption[]; diagnostics: PostProcessDiagnostics } {
  const totalFromProviders = results.length;

  const filteredOutCounts = { overBudget: 0, wrongOrigin: 0, wrongTripLength: 0, tooManyTransfers: 0, tooCold: 0 };

  // Hard filter pass (budget uses priceCzk, which was set before scoring)
  const hardFiltered = results.filter((trip) => {
    if (!request.origins.includes(trip.origin)) {
      filteredOutCounts.wrongOrigin++;
      return false;
    }
    if (request.maxBudget !== undefined) {
      if (trip.priceCzk === undefined) {
        filteredOutCounts.overBudget++;
        return false;
      }
      if (trip.priceCzk > request.maxBudget) {
        filteredOutCounts.overBudget++;
        return false;
      }
    }
    if (request.minNights && trip.nights < request.minNights) {
      filteredOutCounts.wrongTripLength++;
      return false;
    }
    if (request.maxNights && trip.nights > request.maxNights) {
      filteredOutCounts.wrongTripLength++;
      return false;
    }
    if (request.directOnly && !trip.direct) {
      filteredOutCounts.tooManyTransfers++;
      return false;
    }
    if (request.minTemperatureC !== undefined && trip.expectedTemperatureC !== undefined && trip.expectedTemperatureC < request.minTemperatureC) {
      filteredOutCounts.tooCold++;
      return false;
    }
    return true;
  });
  const afterHardFilters = hardFiltered.length;

  const unknownCurrencyCount = results.filter((r) => r.totalPrice !== undefined && r.priceCzk === undefined).length;

  const deduped = deduplicateSimilar(hardFiltered);
  const afterDedup = deduped.length;

  const nonDominated = removeDominated(deduped);
  const afterDominated = nonDominated.length;

  const sorted = sortResults(nonDominated);
  const limited = limitResults(sorted);

  return {
    results: limited,
    diagnostics: {
      totalFromProviders,
      afterHardFilters,
      afterDedup,
      afterDominated,
      displayed: limited.length,
      filteredOutCounts,
      unknownCurrencyCount,
    },
  };
}
