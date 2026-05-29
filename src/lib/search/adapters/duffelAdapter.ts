import type { DuffelMode, ServerEnv } from "@/lib/config/env";
import { mvpDestinations, resolveMvpDestinations, type SearchDestination } from "../destinations";
import type { FlightSegment, ItineraryOption, OriginAirport, ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

const duffelApiBase = "https://api.duffel.com/air/offer_requests";
const duffelVersion = "v2";
const requestTimeoutMs = 6500;
const supplierTimeoutMs = 5000;
const maxOfferRequests = 8;

// ── Duffel API types ─────────────────────────────────────────────────────────

type DuffelSegment = {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  operating_carrier?: { name?: string; iata_code?: string };
  marketing_carrier?: { name?: string; iata_code?: string };
  marketing_carrier_flight_number?: string;
};

type DuffelSliceOffer = {
  segments: DuffelSegment[];
};

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name?: string; iata_code?: string };
  slices: DuffelSliceOffer[];
};

type DuffelResponse = {
  data?: { offers?: DuffelOffer[] };
};

type FetchResult = { offers: DuffelOffer[]; error?: string };

// ── Search planning ──────────────────────────────────────────────────────────

type SearchCombination = {
  origin: OriginAirport;
  destination: SearchDestination;
  departDate: string;
  returnDate: string;
};

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateDatePairs(request: TravelSearchRequest): Array<{ departDate: string; returnDate: string }> {
  const minNights = request.minNights ?? 3;
  const maxNights = request.maxNights ?? 10;
  const targetNights = Math.round((minNights + maxNights) / 2);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now.getTime() + 86400000);

  const fallbackFrom = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const requestedFrom = request.dateFrom ? new Date(request.dateFrom) : fallbackFrom;
  const effectiveFrom = requestedFrom > now ? requestedFrom : tomorrow;
  const toDate = request.dateTo ? new Date(request.dateTo) : new Date(effectiveFrom.getTime() + 30 * 86400000);

  const rangeDays = Math.max(0, Math.round((toDate.getTime() - effectiveFrom.getTime()) / 86400000));
  const departures = [toISODate(effectiveFrom)];
  if (rangeDays >= 7) {
    departures.push(toISODate(new Date(effectiveFrom.getTime() + Math.floor(rangeDays / 2) * 86400000)));
  }

  return departures.map((departDate) => ({
    departDate,
    returnDate: toISODate(new Date(new Date(departDate).getTime() + targetNights * 86400000)),
  }));
}

function buildCombinations(request: TravelSearchRequest): { combinations: SearchCombination[]; limitedToMvpSet: boolean } {
  const { destinations, limitedToMvpSet } = resolveMvpDestinations(request.wish, request.destinationMode);
  const datePairs = generateDatePairs(request);
  const origins = request.origins.slice(0, 2);
  const selectedDestinations = destinations.slice(0, 4);

  const combinations: SearchCombination[] = [];
  for (const { departDate, returnDate } of datePairs) {
    for (const origin of origins) {
      for (const destination of selectedDestinations) {
        combinations.push({ origin, destination, departDate, returnDate });
        if (combinations.length >= maxOfferRequests) return { combinations, limitedToMvpSet };
      }
    }
  }

  return { combinations, limitedToMvpSet };
}

// ── HTTP layer ───────────────────────────────────────────────────────────────

async function fetchOfferRequest(combo: SearchCombination, token: string): Promise<FetchResult> {
  const url = `${duffelApiBase}?return_offers=true&supplier_timeout=${supplierTimeoutMs}&view=offers`;

  const body = JSON.stringify({
    data: {
      slices: [
        { origin: combo.origin, destination: combo.destination.code, departure_date: combo.departDate },
        { origin: combo.destination.code, destination: combo.origin, departure_date: combo.returnDate },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": duffelVersion,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") return { offers: [], error: "timeout" };
    throw err;
  }
  clearTimeout(timeoutId);

  if (process.env.NODE_ENV !== "production") {
    console.info(`[duffel] ${combo.origin}→${combo.destination.code} ${combo.departDate}: HTTP ${response.status}`);
  }

  if (response.status === 401 || response.status === 403) return { offers: [], error: "auth" };
  if (response.status === 404) return { offers: [], error: "not_found" };
  if (response.status === 422) return { offers: [], error: "invalid_route" };
  if (!response.ok) return { offers: [], error: `http_${response.status}` };

  const payload = (await response.json()) as DuffelResponse;
  return { offers: payload.data?.offers ?? [] };
}

// ── Normalization ────────────────────────────────────────────────────────────

function duffelToFlightSegment(seg: DuffelSegment): FlightSegment {
  const carrierName = seg.operating_carrier?.name ?? seg.marketing_carrier?.name;
  const carrierCode = seg.marketing_carrier?.iata_code ?? seg.operating_carrier?.iata_code;
  return {
    origin: seg.origin.iata_code,
    destination: seg.destination.iata_code,
    departureDateTime: seg.departing_at,
    arrivalDateTime: seg.arriving_at,
    carrierName,
    flightNumber:
      carrierCode && seg.marketing_carrier_flight_number
        ? `${carrierCode}${seg.marketing_carrier_flight_number}`
        : undefined,
    durationMinutes:
      seg.departing_at && seg.arriving_at
        ? Math.round((new Date(seg.arriving_at).getTime() - new Date(seg.departing_at).getTime()) / 60000)
        : undefined,
  };
}

function timePart(dt?: string): string {
  return dt?.slice(11, 16) ?? "??:??";
}

function calcLayoverHours(segs: FlightSegment[]): number | undefined {
  if (segs.length <= 1) return undefined;
  let total = 0;
  for (let i = 1; i < segs.length; i++) {
    const gap = new Date(segs[i].departureDateTime).getTime() - new Date(segs[i - 1].arrivalDateTime).getTime();
    if (Number.isFinite(gap) && gap > 0) total += gap / 60000;
  }
  return total > 0 ? Math.round((total / 60) * 10) / 10 : undefined;
}

function normalizeOffer(offer: DuffelOffer, combo: SearchCombination, request: TravelSearchRequest, duffelMode: DuffelMode): ItineraryOption | undefined {
  if (!offer.id || !offer.total_amount || !offer.slices?.length) return undefined;

  const outboundSlice = offer.slices[0];
  const inboundSlice = offer.slices[1];
  if (!outboundSlice?.segments?.length) return undefined;

  const outboundSegments = outboundSlice.segments.map(duffelToFlightSegment);
  const inboundSegments = inboundSlice?.segments?.map(duffelToFlightSegment) ?? [];
  const segments = [...outboundSegments, ...inboundSegments];

  const firstOut = outboundSegments[0];
  const lastOut = outboundSegments[outboundSegments.length - 1];
  const firstIn = inboundSegments[0];

  const depart = firstOut?.departureDateTime?.slice(0, 10);
  if (!depart) return undefined;

  const origin = firstOut.origin as OriginAirport;
  if (!request.origins.includes(origin)) return undefined;

  const destinationAirportCode = lastOut?.destination ?? combo.destination.code;
  const returnDate = firstIn?.departureDateTime?.slice(0, 10) ?? combo.returnDate;
  const nights = Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(depart).getTime()) / 86400000));
  const direct = outboundSegments.length <= 1 && inboundSegments.length <= 1;
  const carrier = offer.owner?.name ?? firstOut?.carrierName ?? "Duffel";

  const destInfo = mvpDestinations.find((d) => d.code === destinationAirportCode);
  const isTest = duffelMode === "test";

  return {
    id: `duffel-${offer.id}`,
    provider: "duffel",
    providerResultId: offer.id,
    source: isTest ? "Duffel (sandbox)" : "Duffel",
    availabilityStatus: isTest ? "mock" : "verified",
    availabilityNote: isTest
      ? "Sandbox nabídka z Duffel test režimu. Nejde o reálné letenky pro nákup."
      : "Ověřená nabídka z Duffel. Před rezervací ověř aktuální dostupnost.",
    priceStatus: isTest ? "unknown" : "live",
    isSandbox: isTest,
    origin,
    destinationAirportCode,
    destination: destInfo?.city ?? combo.destination.city,
    country: destInfo?.country ?? combo.destination.country,
    destinationType: request.destinationMode,
    destinationMode: request.destinationMode,
    dates: { depart, return: returnDate },
    month: Number(depart.slice(5, 7)),
    nights,
    totalPrice: Number(offer.total_amount),
    currency: offer.total_currency,
    airline: carrier,
    sourceUrl: "https://duffel.com/",
    deepLink: undefined,
    linkType: "fallback",
    linkNote: isTest
      ? "Duffel test mode – sandbox data, ne pro nákup."
      : "Booking zatím není implementovaný. Ověř nabídku přímo u Duffelu.",
    departureTime: timePart(firstOut?.departureDateTime),
    returnTime: timePart(firstIn?.departureDateTime),
    baggageIncluded: ["backpack"],
    direct,
    layoverHours: calcLayoverHours(outboundSegments),
    weekendFit: 70,
    destinationValue: 75,
    reliability: isTest ? 0 : 80,
    segments,
    outboundSegments,
    inboundSegments,
    passengers: 1,
    isReturn: inboundSegments.length > 0,
    weatherConfidence: "unknown",
    warnings: [
      "Zavazadlo nebylo parsováno z Duffel odpovědi; zobrazena výchozí hodnota batoh.",
      ...(isTest ? ["Sandbox výsledek – nereálná cena/dostupnost."] : []),
    ],
  };
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class DuffelAdapter implements TravelSourceAdapter {
  readonly name = "duffel" as const;
  readonly mode = "verified" as const;

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.duffelAccessToken);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "DUFFEL_ACCESS_TOKEN is not configured; Duffel offers skipped.");
    }

    const token = this.env.duffelAccessToken!;
    const duffelMode = this.env.duffelMode ?? "live";
    const warnings: string[] = [];
    if (duffelMode === "test") {
      warnings.push("Duffel token is in test mode — results are sandbox data, not real offers.");
    }
    const { combinations, limitedToMvpSet } = buildCombinations(request);

    if (combinations.length === 0) {
      return skippedProviderResult(this.name, "Duffel: no valid search combinations for the requested filters.");
    }

    if (limitedToMvpSet) warnings.push("Duffel search was limited to selected MVP destinations and dates.");

    if (process.env.NODE_ENV !== "production") {
      console.info(`[duffel] planned ${combinations.length} offer request(s)`);
    }

    // Run all requests concurrently to stay within provider timeout
    const settled = await Promise.allSettled(combinations.map((combo) => fetchOfferRequest(combo, token)));

    const allOffers: ItineraryOption[] = [];
    let authError = false;
    let timeoutCount = 0;

    for (let i = 0; i < settled.length; i++) {
      const combo = combinations[i];
      const result = settled[i];

      if (result.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          const msg = result.reason instanceof Error ? result.reason.message : "unknown";
          console.warn(`[duffel] unexpected error for ${combo.origin}→${combo.destination.code}: ${msg}`);
        }
        continue;
      }

      const { offers, error } = result.value;

      if (error === "auth") {
        authError = true;
        break;
      }
      if (error === "timeout") {
        timeoutCount++;
        continue;
      }
      // not_found / invalid_route / http_NNN: silently skip, not fatal
      if (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[duffel] ${combo.origin}→${combo.destination.code}: skipped (${error})`);
        }
        continue;
      }

      if (process.env.NODE_ENV !== "production") {
        console.info(`[duffel] ${combo.origin}→${combo.destination.code}: ${offers.length} offers`);
      }

      for (const offer of offers) {
        const normalized = normalizeOffer(offer, combo, request, duffelMode);
        if (normalized) allOffers.push(normalized);
      }
    }

    if (authError) {
      return {
        provider: this.name,
        status: "error",
        results: [],
        warnings: [...warnings, "Duffel rejected the configured access token."],
        errorMessage: "Duffel rejected the configured access token.",
      };
    }

    if (timeoutCount > 0 && allOffers.length === 0 && timeoutCount === combinations.length) {
      return {
        provider: this.name,
        status: "error",
        results: [],
        warnings: [...warnings, "Duffel search timed out."],
        errorMessage: "Duffel search timed out.",
      };
    }

    if (timeoutCount > 0) warnings.push(`Duffel search timed out for ${timeoutCount} route(s).`);

    if (process.env.NODE_ENV !== "production") {
      console.info(`[duffel] total normalized offers: ${allOffers.length}`);
    }

    if (allOffers.length === 0) warnings.push("Duffel returned no offers for selected routes/dates.");

    return {
      provider: this.name,
      status: "success",
      results: allOffers,
      warnings,
    };
  }
}
