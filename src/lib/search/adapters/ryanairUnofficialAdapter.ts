import type { ServerEnv } from "@/lib/config/env";
import { mvpDestinations } from "../destinations";
import type { FlightSegment, ItineraryOption, OriginAirport, ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

const farFinderBase = "https://www.ryanair.com/api/farfnd/3/oneWayFares";
const maxDestinationsPerOrigin = 3;

// ── Ryanair API types ──────────────────────────────────────────────────────────

type RyanairAirport = {
  iataCode: string;
  name?: string;
  countryName?: string;
};

type RyanairFare = {
  outbound: {
    departureAirport: RyanairAirport;
    arrivalAirport: RyanairAirport;
    departureDate: string;
    arrivalDate?: string;
    flightNumber?: string;
    price: { value: number; currencyCode: string };
    soldOut?: boolean;
  };
};

type RyanairFaresResponse = {
  fares?: RyanairFare[];
};

type RyanairFetchResult = {
  fares: RyanairFare[];
  timedOut: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoDate(dt: string): string {
  return dt.slice(0, 10);
}

function isoTime(dt: string): string {
  return dt.length >= 16 ? dt.slice(11, 16) : "??:??";
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function generateDateWindow(request: TravelSearchRequest): { dateFrom: string; dateTo: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fallbackFrom = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const from = request.dateFrom ? new Date(request.dateFrom) : fallbackFrom;
  const effectiveFrom = from > now ? from : new Date(now.getTime() + 86400000);
  const to = request.dateTo ? new Date(request.dateTo) : new Date(effectiveFrom.getTime() + 30 * 86400000);
  return {
    dateFrom: effectiveFrom.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

// ── HTTP layer ─────────────────────────────────────────────────────────────────

async function fetchFares(
  departureIata: string,
  arrivalIata: string | undefined,
  dateFrom: string,
  dateTo: string,
  timeoutMs: number,
  maxPriceEur?: number,
): Promise<RyanairFetchResult> {
  const params = new URLSearchParams({
    departureAirportIataCode: departureIata,
    language: "cs-cz",
    limit: "16",
    market: "cs-cz",
    toUs: "AGREED",
    currency: "EUR",
    adultPaxCount: "1",
    outboundDepartureDateFrom: dateFrom,
    outboundDepartureDateTo: dateTo,
  });
  if (arrivalIata) params.set("arrivalAirportIataCode", arrivalIata);
  if (maxPriceEur !== undefined) params.set("priceValueTo", String(Math.ceil(maxPriceEur)));

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${farFinderBase}?${params.toString()}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Referer: "https://www.ryanair.com/cz/cs",
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(tid);
    if (err instanceof Error && err.name === "AbortError") {
      if (process.env.NODE_ENV !== "production") console.warn(`[ryanair-unofficial] timeout: ${departureIata}→${arrivalIata ?? "any"}`);
      return { fares: [], timedOut: true };
    }
    throw err;
  }
  clearTimeout(tid);

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ryanair-unofficial] HTTP ${response.status}: ${departureIata}→${arrivalIata ?? "any"}`);
    }
    return { fares: [], timedOut: false };
  }

  const data = (await response.json()) as RyanairFaresResponse;
  return { fares: (data.fares ?? []).filter((f) => !f.outbound.soldOut), timedOut: false };
}

// ── Normalization ──────────────────────────────────────────────────────────────

function normalizeRoundTrip(
  outFare: RyanairFare,
  origin: OriginAirport,
  retFare: RyanairFare,
  request: TravelSearchRequest,
): ItineraryOption {
  const out = outFare.outbound;
  const ret = retFare.outbound;

  const departDate = isoDate(out.departureDate);
  const returnDate = isoDate(ret.departureDate);
  const destIata = out.arrivalAirport.iataCode;

  const nights = Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000));

  const mvpDest = mvpDestinations.find((d) => d.code === destIata);
  const city = mvpDest?.city ?? out.arrivalAirport.name ?? destIata;
  const country = mvpDest?.country ?? out.arrivalAirport.countryName ?? "";
  const destMode = mvpDest?.modes[0] ?? request.destinationMode;

  const totalEur = out.price.value + ret.price.value;

  const outboundSeg: FlightSegment = {
    origin,
    destination: destIata,
    departureDateTime: out.departureDate,
    arrivalDateTime: out.arrivalDate ?? out.departureDate,
    carrierName: "Ryanair",
    flightNumber: out.flightNumber,
    durationMinutes: undefined,
  };

  const inboundSeg: FlightSegment = {
    origin: destIata,
    destination: origin,
    departureDateTime: ret.departureDate,
    arrivalDateTime: ret.arrivalDate ?? ret.departureDate,
    carrierName: "Ryanair",
    flightNumber: ret.flightNumber,
    durationMinutes: undefined,
  };

  return {
    id: `ryanair-unofficial-${origin}-${destIata}-${departDate}-${returnDate}`,
    provider: "ryanair-unofficial",
    source: "Ryanair",
    availabilityStatus: "search",
    priceStatus: "estimated",
    linkType: "search",
    linkNote: "Neoficiální zdroj. Otevře se vyhledávání u Ryanairu — dostupnost a finální cenu ověř přímo u dopravce.",
    availabilityNote: "Výsledek z neoficiálního Ryanair zdroje pro osobní použití. Dostupnost a finální cenu ověř přímo u dopravce.",
    origin,
    destinationAirportCode: destIata,
    destination: city,
    country,
    destinationType: destMode,
    destinationMode: destMode,
    dates: { depart: departDate, return: returnDate },
    month: Number(departDate.slice(5, 7)),
    nights,
    totalPrice: totalEur,
    currency: "EUR",
    airline: "Ryanair",
    // sourceUrl is a placeholder — normalizeProviderLink in the pipeline will build the real Ryanair search URL
    sourceUrl: "https://www.ryanair.com/cz/cs",
    deepLink: undefined,
    departureTime: isoTime(out.departureDate),
    returnTime: isoTime(ret.departureDate),
    baggageIncluded: ["backpack"],
    direct: true,
    layoverHours: undefined,
    weekendFit: 70,
    destinationValue: mvpDest ? 75 : 60,
    reliability: 65,
    segments: [outboundSeg, inboundSeg],
    outboundSegments: [outboundSeg],
    inboundSegments: [inboundSeg],
    passengers: 1,
    isReturn: true,
    weatherConfidence: "unknown",
    warnings: [
      "Neoficiální zdroj. Cena a dostupnost bez garance. Ověř u dopravce.",
      "Cena je součet nejlevnějšího odletu a zpátečního spoje z fare finderu — nemusí jít o tutéž konkrétní kombinaci.",
    ],
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────────

export class RyanairUnofficialAdapter implements TravelSourceAdapter {
  readonly name = "ryanair-unofficial" as const;
  readonly mode = "unofficial" as const;

  constructor(private readonly env: ServerEnv) {}

  isConfigured(): boolean {
    if (!this.env.enableRyanairUnofficial) return false;
    if (process.env.NODE_ENV === "production" && !this.env.allowUnofficialInProduction) return false;
    return true;
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(
        this.name,
        "Neoficiální Ryanair zdroj je vypnutý. Nastav ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true pro osobní použití.",
      );
    }

    const origins = request.origins.slice(0, 2) as OriginAirport[];
    const { dateFrom, dateTo } = generateDateWindow(request);
    const minNights = request.minNights ?? 3;
    const maxNights = request.maxNights ?? 10;
    const timeoutMs = this.env.ryanairUnofficialTimeoutMs;
    let requestCount = 0;
    let timeoutCount = 0;
    // Half of the budget per leg, converted from CZK to EUR at ~25 rate
    const maxPerLegEur = request.maxBudget !== undefined ? Math.ceil(request.maxBudget / 25 / 2) : undefined;

    if (process.env.NODE_ENV !== "production") {
      console.info(`[ryanair-unofficial] origins=${origins.join(",")} dates=${dateFrom}…${dateTo} maxPerLegEur=${maxPerLegEur ?? "none"}`);
    }

    // Phase 1: outbound fares for all origins concurrently (no destination filter = all available routes)
    const outboundSettled = await Promise.allSettled(
      origins.map((origin) =>
        fetchFares(origin, undefined, dateFrom, dateTo, timeoutMs, maxPerLegEur).then((result) => ({
          origin,
          fares: result.fares.sort((a, b) => a.outbound.price.value - b.outbound.price.value).slice(0, maxDestinationsPerOrigin),
          timedOut: result.timedOut,
        })),
      ),
    );
    requestCount += origins.length;

    type Candidate = { origin: OriginAirport; outFare: RyanairFare; retDateFrom: string; retDateTo: string };
    const candidates: Candidate[] = [];

    for (const result of outboundSettled) {
      if (result.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          const msg = result.reason instanceof Error ? result.reason.message : "unknown";
          console.warn(`[ryanair-unofficial] outbound fetch error: ${msg}`);
        }
        continue;
      }
      const { origin, fares, timedOut } = result.value;
      if (timedOut) timeoutCount += 1;
      if (process.env.NODE_ENV !== "production") {
        console.info(`[ryanair-unofficial] ${origin}: ${fares.length} outbound destination(s)`);
      }
      for (const outFare of fares) {
        const departDate = isoDate(outFare.outbound.departureDate);
        candidates.push({
          origin,
          outFare,
          retDateFrom: addDays(departDate, minNights),
          retDateTo: addDays(departDate, maxNights),
        });
      }
    }

    if (candidates.length === 0) {
      const timedOut = timeoutCount > 0;
      return {
        provider: this.name,
        status: timedOut ? "timeout" : "success",
        results: [],
        warnings: [
          "Neoficiální Ryanair zdroj pro osobní použití. Dostupnost a cenu vždy ověř u dopravce.",
          timedOut
            ? `Ryanair nestihl odpovědět do ${Math.round(timeoutMs / 1000)} s. Zobrazujeme ostatní zdroje.`
            : "Ryanair fare finder nevrátil žádné výsledky pro zadané podmínky.",
        ],
        requestCount,
        timeoutCount,
      };
    }

    // Phase 2: return fares for all candidates concurrently
    const returnSettled = await Promise.allSettled(
      candidates.map(({ outFare, origin, retDateFrom, retDateTo }) =>
        fetchFares(outFare.outbound.arrivalAirport.iataCode, origin, retDateFrom, retDateTo, timeoutMs, maxPerLegEur),
      ),
    );
    requestCount += candidates.length;

    const allOffers: ItineraryOption[] = [];

    for (let i = 0; i < returnSettled.length; i++) {
      const retResult = returnSettled[i];
      if (retResult.status === "rejected") continue;
      if (retResult.value.timedOut) timeoutCount += 1;
      const retFares = retResult.value.fares;
      if (retFares.length === 0) continue;

      const cheapestReturn = retFares.sort((a, b) => a.outbound.price.value - b.outbound.price.value)[0];
      const { origin, outFare } = candidates[i];

      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[ryanair-unofficial] ${origin}→${outFare.outbound.arrivalAirport.iataCode}: out=${outFare.outbound.price.value} EUR ret=${cheapestReturn.outbound.price.value} EUR`,
        );
      }

      allOffers.push(normalizeRoundTrip(outFare, origin, cheapestReturn, request));
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(`[ryanair-unofficial] total offers normalized: ${allOffers.length}`);
    }

    const warnings = ["Neoficiální Ryanair zdroj pro osobní použití. Dostupnost a cenu vždy ověř u dopravce."];
    if (timeoutCount > 0 && allOffers.length === 0) {
      warnings.push(`Ryanair nestihl odpovědět do ${Math.round(timeoutMs / 1000)} s. Zobrazujeme ostatní zdroje.`);
    } else if (timeoutCount > 0) {
      warnings.push(`Část Ryanair dotazů nestihla odpovědět do ${Math.round(timeoutMs / 1000)} s. Výsledky mohou být neúplné.`);
    }
    if (allOffers.length === 0) {
      warnings.push("Ryanair fare finder nevrátil žádné výsledky — možná nemá přímé lety z vybraných letišť nebo chybí zpáteční spoj.");
    }

    return {
      provider: this.name,
      status: timeoutCount > 0 && allOffers.length === 0 ? "timeout" : "success",
      results: allOffers,
      warnings,
      requestCount,
      timeoutCount,
    };
  }
}
