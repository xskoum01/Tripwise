import type { ServerEnv } from "@/lib/config/env";
import { resolveMvpDestinations } from "../destinations";
import type { FlightSegment, ItineraryOption, OriginAirport, ProviderSearchResult, TravelSearchRequest } from "../types";
import { errorProviderResult, skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

const apiUrl = "https://tequila-api.kiwi.com/v2/search";
const requestTimeoutMs = 7500;

type KiwiRoute = {
  flyFrom?: string;
  flyTo?: string;
  cityFrom?: string;
  cityTo?: string;
  local_departure?: string;
  local_arrival?: string;
  airline?: string;
  flight_no?: number;
  return?: number;
};

type KiwiTrip = {
  id?: string;
  cityFrom?: string;
  cityTo?: string;
  countryTo?: { name?: string };
  flyFrom?: string;
  flyTo?: string;
  local_departure?: string;
  local_arrival?: string;
  price?: number;
  deep_link?: string;
  airlines?: string[];
  route?: KiwiRoute[];
  nightsInDest?: number;
  availability?: { seats?: number };
};

type KiwiResponse = {
  data?: KiwiTrip[];
};

function formatKiwiDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function isoDate(dateTime?: string) {
  return dateTime?.slice(0, 10);
}

function timePart(dateTime?: string) {
  return dateTime?.slice(11, 16) ?? "??:??";
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  return Math.round(duration / 60000);
}

function kiwiSegmentToFlightSegment(segment: KiwiRoute): FlightSegment {
  return {
    origin: segment.flyFrom ?? "",
    destination: segment.flyTo ?? "",
    departureDateTime: segment.local_departure ?? "",
    arrivalDateTime: segment.local_arrival ?? "",
    carrierName: segment.airline,
    flightNumber: segment.flight_no && segment.airline ? `${segment.airline}${segment.flight_no}` : undefined,
    durationMinutes: minutesBetween(segment.local_departure, segment.local_arrival),
  };
}

function layoverHours(segments: FlightSegment[]) {
  if (segments.length <= 1) return undefined;

  let totalMinutes = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previousArrival = new Date(segments[index - 1].arrivalDateTime).getTime();
    const nextDeparture = new Date(segments[index].departureDateTime).getTime();
    const layover = nextDeparture - previousArrival;
    if (Number.isFinite(layover) && layover > 0) totalMinutes += layover / 60000;
  }

  return totalMinutes > 0 ? Math.round((totalMinutes / 60) * 10) / 10 : undefined;
}

function normalizeTrip(trip: KiwiTrip, request: TravelSearchRequest): ItineraryOption | undefined {
  const depart = isoDate(trip.local_departure);
  const returnDate = trip.route ? isoDate([...trip.route].reverse().find((segment) => segment.return === 1)?.local_departure) : undefined;
  const destinationAirportCode = trip.flyTo;
  const origin = trip.flyFrom as OriginAirport | undefined;

  if (!trip.id || !depart || !returnDate || !destinationAirportCode || !origin || !request.origins.includes(origin)) {
    return undefined;
  }

  const outboundSegments = (trip.route ?? []).filter((segment) => segment.return !== 1).map(kiwiSegmentToFlightSegment);
  const inboundSegments = (trip.route ?? []).filter((segment) => segment.return === 1).map(kiwiSegmentToFlightSegment);
  const segments = [...outboundSegments, ...inboundSegments];
  const carrier = trip.airlines?.[0] ?? segments.find((segment) => segment.carrierName)?.carrierName ?? "Kiwi";
  const nights = trip.nightsInDest ?? Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(depart).getTime()) / 86400000));
  const direct = outboundSegments.length <= 1 && inboundSegments.length <= 1;

  return {
    id: `kiwi-${trip.id}`,
    provider: "kiwi",
    providerResultId: trip.id,
    source: "Kiwi",
    availabilityStatus: "verified",
    availabilityNote: "Výsledek pochází z Kiwi/Tequila API. Dostupnost a cena se mohou do otevření nabídky změnit.",
    priceStatus: "live",
    origin,
    destinationAirportCode,
    destination: trip.cityTo ?? destinationAirportCode,
    country: trip.countryTo?.name,
    destinationType: request.destinationMode,
    destinationMode: request.destinationMode,
    dates: { depart, return: returnDate },
    month: Number(depart.slice(5, 7)),
    nights,
    totalPrice: trip.price,
    currency: "CZK",
    airline: carrier,
    sourceUrl: trip.deep_link ?? "https://www.kiwi.com/",
    deepLink: trip.deep_link,
    linkType: trip.deep_link ? "exact" : "search",
    linkNote: trip.deep_link ? undefined : "Kiwi nevrátil přímý odkaz, otevře se zdroj.",
    departureTime: timePart(trip.local_departure),
    returnTime: timePart(inboundSegments[0]?.departureDateTime),
    baggageIncluded: ["backpack"],
    direct,
    layoverHours: layoverHours(segments),
    weekendFit: 70,
    destinationValue: 78,
    reliability: trip.availability?.seats ? 88 : 78,
    segments,
    outboundSegments,
    inboundSegments,
    passengers: 1,
    isReturn: true,
    weatherConfidence: "unknown",
  };
}

function buildSearchUrl(request: TravelSearchRequest) {
  const { destinations, limitedToMvpSet } = resolveMvpDestinations(request.wish, request.destinationMode);
  const url = new URL(apiUrl);

  url.searchParams.set("fly_from", request.origins.join(","));
  url.searchParams.set("fly_to", destinations.map((destination) => destination.code).join(","));
  url.searchParams.set("date_from", formatKiwiDate(request.dateFrom ?? `${new Date().getFullYear()}-06-01`));
  url.searchParams.set("date_to", formatKiwiDate(request.dateTo ?? `${new Date().getFullYear()}-12-31`));
  url.searchParams.set("nights_in_dst_from", String(request.minNights ?? 1));
  url.searchParams.set("nights_in_dst_to", String(request.maxNights ?? 14));
  url.searchParams.set("curr", "CZK");
  url.searchParams.set("adults", "1");
  url.searchParams.set("limit", "30");
  url.searchParams.set("sort", "price");
  url.searchParams.set("partner_market", "cz");

  if (request.maxBudget) url.searchParams.set("price_to", String(request.maxBudget));
  if (request.directOnly) url.searchParams.set("max_stopovers", "0");

  return { url, limitedToMvpSet };
}

export class KiwiAdapter implements TravelSourceAdapter {
  readonly name = "kiwi" as const;
  readonly mode = "verified" as const;

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.kiwiApiKey);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "KIWI_API_KEY is not configured; Kiwi/Tequila results skipped.");
    }

    const warnings: string[] = [];
    const { url, limitedToMvpSet } = buildSearchUrl(request);
    if (limitedToMvpSet) warnings.push("Kiwi search was limited to configured MVP destination set.");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

      if (process.env.NODE_ENV !== "production") {
        console.info(`[kiwi] GET ${url.toString()}`);
      }

      const response = await fetch(url, {
        headers: {
          apikey: this.env.kiwiApiKey ?? "",
          accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (process.env.NODE_ENV !== "production") {
        console.info(`[kiwi] response status ${response.status}`);
      }

      if (response.status === 401 || response.status === 403) {
        return {
          provider: this.name,
          status: "error",
          results: [],
          warnings: [...warnings, "Kiwi API rejected the configured key."],
          errorMessage: "Kiwi API rejected the configured key.",
        };
      }

      if (!response.ok) {
        return {
          provider: this.name,
          status: "error",
          results: [],
          warnings: [...warnings, `Kiwi API returned HTTP ${response.status}.`],
          errorMessage: `Kiwi API returned HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as KiwiResponse;
      const results = (payload.data ?? []).map((trip) => normalizeTrip(trip, request)).filter((trip): trip is ItineraryOption => Boolean(trip));

      if (process.env.NODE_ENV !== "production") {
        console.info(`[kiwi] normalized result count ${results.length}`);
      }

      if (results.length === 0) warnings.push("Kiwi returned no trips for the requested filters.");

      return {
        provider: this.name,
        status: "success",
        results,
        warnings,
      };
    } catch (error) {
      return errorProviderResult(this.name, error);
    }
  }
}
