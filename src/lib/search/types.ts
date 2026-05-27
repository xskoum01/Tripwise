export type AirportCode =
  | "PRG"
  | "VIE"
  | "BRQ"
  | "PED"
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
export type OriginAirport = "PRG" | "VIE" | "BRQ" | "PED";
export type BaggageOption = "backpack" | "cabin" | "checked";
export type DestinationMode = "any" | "sea" | "warm" | "cityBreak";
export type LinkType = "exact" | "search" | "fallback";

export type TravelSearchRequest = {
  wish: string;
  origins: OriginAirport[];
  targetMonth?: number;
  dateFrom?: string;
  dateTo?: string;
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

export type ItineraryOption = {
  id: string;
  destination: string;
  country: string;
  destinationAirportCode: AirportCode;
  destinationType: DestinationMode;
  destinationMode: DestinationMode;
  dates: {
    depart: string;
    return: string;
  };
  month: number;
  expectedTemperatureC: number;
  nights: number;
  origin: OriginAirport;
  totalPrice: number;
  currency: "CZK";
  airline: string;
  source: "Ryanair" | "Skyscanner" | "Kiwi" | "Mock";
  sourceUrl: string;
  linkType: LinkType;
  passengers: number;
  isReturn: boolean;
  departureTime: string;
  returnTime: string;
  baggageIncluded: BaggageOption[];
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
};

export type SearchResponse = {
  parsedRequest: TravelSearchRequest;
  appliedFilters: TravelSearchRequest;
  exactResults: ItineraryOption[];
  relaxedResults: ItineraryOption[];
  results: ItineraryOption[];
  assumptions: string[];
  unsupportedConstraints: string[];
  relaxationMessages: string[];
  featured: {
    bestValue?: ItineraryOption;
    cheapest?: ItineraryOption;
    mostComfortable?: ItineraryOption;
    bestWeekend?: ItineraryOption;
  };
};
