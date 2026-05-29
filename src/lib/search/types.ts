export type DatePrecision = "month" | "early-month" | "mid-month" | "late-month" | "month-transition" | "week";

// Confidence level for the data source behind a result.
//   official        — live data from an official airline or GDS API
//   official-test   — official API but test/sandbox environment
//   unofficial      — public endpoint not intended for third-party programmatic use
//   cached          — previously fetched official data, may be stale
//   search-only     — no price fetched; result is a manual verification link only
//   demo            — synthetic demo/mock data
//   user-verified   — price confirmed by user after manual check
export type SourceConfidence =
  | "official"
  | "official-test"
  | "unofficial"
  | "cached"
  | "search-only"
  | "demo"
  | "user-verified";

export type AirportCode =
  | "PRG"
  | "VIE"
  | "BRQ"
  | "PED"
  | "BTS"
  | "OSR"
  | "TFS"
  | "LPA"
  | "AGP"
  | "FNC"
  | "LCA"
  | "MLA"
  | "NCE"
  | "SPU"
  | "BCN"
  | "CPH";

export type OriginAirport = "PRG" | "VIE" | "BRQ" | "PED" | "BTS" | "OSR";
export type BaggageOption = "backpack" | "cabin" | "checked";
export type DestinationMode = "any" | "sea" | "warm" | "cityBreak";
export type LinkType = "exact" | "search" | "fallback";
export type ProviderName =
  | "skyscanner-live"
  | "skyscanner-indicative"
  | "duffel"
  | "kiwi"
  | "ryanair-deeplink"
  | "ryanair-unofficial"
  | "airline-search-link"
  | "open-meteo"
  | "mock";
export type ProviderMode = "verified" | "indicative" | "search" | "fallback" | "enrichment" | "demo" | "unofficial" | "search-only";
export type TravelSource = "Ryanair" | "Skyscanner" | "Kiwi" | "Mock" | "Duffel" | "Tripwise demo" | (string & {});
export type AvailabilityStatus = "verified" | "indicative" | "search" | "fallback" | "mock";
export type PriceStatus = "live" | "cached" | "estimated" | "unknown";
export type WeatherConfidence = "forecast" | "climate" | "unknown";

export type ProviderStatus = {
  name: ProviderName;
  configured: boolean;
  enabled: boolean;
  mode: ProviderMode;
  message?: string;
  diagnostics?: {
    keyLength?: number;
    envVarName?: string;
  };
};

export type TravelSearchRequest = {
  wish: string;
  origins: OriginAirport[];
  targetMonth?: number;
  dateFrom?: string;
  dateTo?: string;
  datePrecision?: DatePrecision;
  dateLabel?: string;
  minTemperatureC?: number;
  maxBudget?: number;
  minNights?: number;
  maxNights?: number;
  baggage: BaggageOption;
  avoidEarlyFlights: boolean;
  directOnly: boolean;
  weekendOnly: boolean;
  destinationMode: DestinationMode;
  intent: "cheapest" | "value" | "comfort" | "weekend";
  assumptions?: string[];
  unsupportedConstraints?: string[];
};

export type TripSearchRequest = TravelSearchRequest;

export type ScoreBreakdown = {
  price: number;
  comfort: number;
  timing: number;
  risk: number;
  destinationValue: number;
};

export type FlightSegment = {
  origin: string;
  destination: string;
  departureDateTime: string;
  arrivalDateTime: string;
  carrierName?: string;
  flightNumber?: string;
  durationMinutes?: number;
};

export type ItineraryOption = {
  id: string;
  provider: ProviderName;
  providerResultId?: string;
  destination: string;
  country?: string;
  destinationAirportCode: string;
  destinationType: DestinationMode;
  destinationMode: DestinationMode;
  dates: {
    depart: string;
    return: string;
  };
  month: number;
  expectedTemperatureC?: number;
  nights: number;
  origin: OriginAirport;
  originName?: string;
  totalPrice?: number;
  currency?: string;
  priceCzk?: number;
  priceStatus: PriceStatus;
  sourceConfidence?: SourceConfidence;
  airline: string;
  source: TravelSource;
  sourceUrl: string;
  deepLink?: string;
  linkType: LinkType;
  linkNote?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityNote?: string;
  weatherConfidence?: WeatherConfidence;
  passengers?: number;
  isReturn?: boolean;
  segments: FlightSegment[];
  outboundSegments: FlightSegment[];
  inboundSegments: FlightSegment[];
  departureTime: string;
  returnTime: string;
  baggageIncluded?: BaggageOption[];
  direct: boolean;
  layoverHours?: number;
  weekendFit: number;
  destinationValue: number;
  reliability: number;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  explanation?: string;
  warnings?: string[];
  relaxationReasons?: string[];
  isSandbox?: boolean;
};

export type ProviderSearchResult = {
  provider: ProviderName;
  status: "success" | "skipped" | "error";
  results: ItineraryOption[];
  warnings: string[];
  errorMessage?: string;
};

export type PostProcessDiagnostics = {
  totalFromProviders: number;
  afterHardFilters: number;
  afterDedup: number;
  afterDominated: number;
  displayed: number;
  filteredOutCounts: {
    overBudget: number;
    wrongOrigin: number;
    wrongTripLength: number;
    tooManyTransfers: number;
    tooCold: number;
  };
  unknownCurrencyCount: number;
};

export type SearchResponse = {
  parsedRequest: TravelSearchRequest;
  appliedFilters: TravelSearchRequest;
  exactResults: ItineraryOption[];
  indicativeResults: ItineraryOption[];
  relaxedResults: ItineraryOption[];
  results: ItineraryOption[];
  noActiveFlightProviders: boolean;
  providerStatuses: ProviderStatus[];
  providerWarnings: string[];
  assumptions: string[];
  unsupportedConstraints: string[];
  relaxationMessages: string[];
  featured: {
    bestValue?: ItineraryOption;
    cheapest?: ItineraryOption;
    mostComfortable?: ItineraryOption;
    bestWeekend?: ItineraryOption;
  };
  postProcessDiagnostics?: PostProcessDiagnostics;
  sandboxResults: ItineraryOption[];
  searchOnlyResults: ItineraryOption[];
};
