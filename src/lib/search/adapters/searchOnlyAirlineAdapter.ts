// Search-only airline adapter.
// Generates manual-verification candidates for low-cost and leisure airlines
// where no priced API endpoint is available.
//
// Rules:
//   - Never returns a price (totalPrice, priceCzk are undefined).
//   - availabilityStatus: "search", priceStatus: "unknown".
//   - sourceConfidence: "search-only".
//   - Each result links to the airline's website for manual verification.
//   - Results must not appear in the main scored recommendations.
//   - max 20 total results, max 3 per airline, max 3 per origin, max 2 per destination.

import { AIRLINE_BY_ID } from "../airlines";
import { buildAirlineVerificationLink } from "../airlineLinks";
import { CANDIDATE_DESTINATION_MAP, CANDIDATE_DESTINATIONS, ROUTE_CANDIDATES } from "../routeCandidates";
import type { DestinationMode, ItineraryOption, OriginAirport, ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

// ── Limits ───────────────────────────────────────────────────────────────────

const MAX_TOTAL = 20;
const MAX_PER_AIRLINE = 3;
const MAX_PER_ORIGIN = 3;
const MAX_PER_DESTINATION = 2;

// ── Date helpers ─────────────────────────────────────────────────────────────

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getSearchDates(request: TravelSearchRequest): { departDate: string; returnDate: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const from = request.dateFrom ? new Date(request.dateFrom) : fallback;
  const effectiveFrom = from > now ? from : new Date(now.getTime() + 2 * 86400000);

  const to = request.dateTo ? new Date(request.dateTo) : new Date(effectiveFrom.getTime() + 30 * 86400000);
  const rangeDays = Math.max(0, Math.round((to.getTime() - effectiveFrom.getTime()) / 86400000));
  const midpoint = new Date(effectiveFrom.getTime() + Math.floor(rangeDays / 2) * 86400000);

  const departDate = midpoint.toISOString().slice(0, 10);
  const targetNights = Math.round(((request.minNights ?? 3) + (request.maxNights ?? 7)) / 2);
  return { departDate, returnDate: addDays(departDate, targetNights) };
}

// ── Destination selection ────────────────────────────────────────────────────

function getRelevantDestinations(mode: DestinationMode, specificCodes?: string[]): typeof CANDIDATE_DESTINATIONS {
  if (specificCodes && specificCodes.length > 0) {
    return specificCodes.flatMap((code) => {
      const dest = CANDIDATE_DESTINATION_MAP.get(code);
      return dest ? [dest] : [];
    });
  }
  if (mode === "any") return CANDIDATE_DESTINATIONS;
  return CANDIDATE_DESTINATIONS.filter((d) => d.modes.includes(mode));
}

// ── Normalization ─────────────────────────────────────────────────────────────

function buildCandidate(
  airlineId: string,
  origin: OriginAirport,
  destCode: string,
  destCity: string,
  destCountry: string,
  destMode: DestinationMode,
  departDate: string,
  returnDate: string,
): ItineraryOption {
  const airline = AIRLINE_BY_ID.get(airlineId);
  const airlineName = airline?.name ?? airlineId;

  const verLink = buildAirlineVerificationLink({
    airlineId,
    origin,
    destination: destCode,
    departDate,
    returnDate,
    adults: 1,
  });

  const nights = Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000));

  return {
    id: `search-only-${airlineId}-${origin}-${destCode}-${departDate}`,
    provider: "airline-search-link",
    source: airlineName,
    airline: airlineName,
    availabilityStatus: "search",
    priceStatus: "unknown",
    sourceConfidence: "search-only",
    linkType: verLink.linkKind === "homepage" ? "fallback" : "search",
    linkConfidence: verLink.confidence,
    linkNote: verLink.note,
    linkValidationStatus: verLink.validationStatus,
    linkValidationNote: verLink.validationNote,
    linkLastValidatedAt: verLink.lastValidatedAt,
    availabilityNote: `Pouze ověřovací odkaz. Tripwise u tohoto dopravce nezískal cenu automaticky.`,
    origin,
    destinationAirportCode: destCode,
    destination: destCity,
    country: destCountry,
    destinationType: destMode,
    destinationMode: destMode,
    dates: { depart: departDate, return: returnDate },
    month: Number(departDate.slice(5, 7)),
    nights,
    totalPrice: undefined,
    currency: undefined,
    priceCzk: undefined,
    sourceUrl: verLink.url,
    deepLink: verLink.url,
    departureTime: "??:??",
    returnTime: "??:??",
    direct: true,
    layoverHours: undefined,
    weekendFit: 50,
    destinationValue: 50,
    reliability: 0,
    segments: [],
    outboundSegments: [],
    inboundSegments: [],
    passengers: 1,
    isReturn: true,
    weatherConfidence: "unknown",
    warnings: [
      "Tripwise u tohoto zdroje automaticky nezískal cenu. Ověř cenu a dostupnost ručně.",
      `Neoficiální zdroj. Cena a dostupnost bez garance. Ověř u ${airlineName}.`,
    ],
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class SearchOnlyAirlineAdapter implements TravelSourceAdapter {
  readonly name = "airline-search-link" as const;
  readonly mode = "search-only" as const;

  constructor(private readonly enabled: boolean) {}

  isConfigured(): boolean {
    return this.enabled;
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(
        this.name,
        "Airline search-link provider is disabled. Set ENABLE_AIRLINE_SEARCH_LINKS=true.",
      );
    }

    const { departDate, returnDate } = getSearchDates(request);
    const requestedOrigins = new Set(request.origins);
    const destMode = request.destinationMode;

    // Counters for limits
    const countByAirline = new Map<string, number>();
    const countByOrigin = new Map<string, number>();
    const countByDest = new Map<string, number>();
    const results: ItineraryOption[] = [];
    let homepageCount = 0;
    let searchCount = 0;
    let limitHits = 0;

    // Filter route candidates relevant to this request
    const relevantCandidates = ROUTE_CANDIDATES.filter((rc) => {
      if (!requestedOrigins.has(rc.origin as OriginAirport)) return false;
      if (destMode === "any") return true;
      return rc.destinationModes.includes(destMode) || rc.destinationModes.includes("any");
    });

    for (const rc of relevantCandidates) {
      if (results.length >= MAX_TOTAL) break;

      const airline = AIRLINE_BY_ID.get(rc.airlineId);
      if (!airline) continue;

      const origin = rc.origin as OriginAirport;
      const destinations = getRelevantDestinations(destMode, rc.destinationCodes).slice(0, 4);

      for (const dest of destinations) {
        if (results.length >= MAX_TOTAL) break;
        const airlineCount = countByAirline.get(rc.airlineId) ?? 0;
        const originCount = countByOrigin.get(origin) ?? 0;
        const destCount = countByDest.get(dest.code) ?? 0;

        if (airlineCount >= MAX_PER_AIRLINE || originCount >= MAX_PER_ORIGIN || destCount >= MAX_PER_DESTINATION) {
          limitHits++;
          if (airlineCount >= MAX_PER_AIRLINE) break;
          continue;
        }

        const candidate = buildCandidate(
          rc.airlineId,
          origin,
          dest.code,
          dest.city,
          dest.country,
          destMode === "any" ? (dest.modes[0] ?? "any") : destMode,
          departDate,
          returnDate,
        );

        results.push(candidate);
        countByAirline.set(rc.airlineId, airlineCount + 1);
        countByOrigin.set(origin, originCount + 1);
        countByDest.set(dest.code, destCount + 1);

        if (candidate.linkType === "fallback") homepageCount++;
        else searchCount++;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[airline-search-link] ${results.length} candidates · ${searchCount} search links · ${homepageCount} homepage links · ${limitHits} limit hits`,
      );
      for (const [id, count] of countByAirline.entries()) {
        console.info(`  ${id}: ${count}`);
      }
    }

    const diagLine = `airline-search-link: ${results.length} odkaz${results.length === 1 ? "" : "ů"} · ${searchCount} hledání · ${homepageCount} homepage`;

    return {
      provider: this.name,
      status: "success",
      results,
      warnings: results.length > 0
        ? [
            "Sekce ověřovacích odkazů neobsahuje ceny — cenu a dostupnost ověř přímo u každého dopravce.",
            diagLine,
          ]
        : ["Airline search-link provider: no candidates matched the request."],
    };
  }
}
