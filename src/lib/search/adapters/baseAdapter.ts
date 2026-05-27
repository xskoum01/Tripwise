import type { ItineraryOption, TravelSearchRequest } from "../types";

export interface TravelSourceAdapter {
  readonly name: string;
  searchTrips(request: TravelSearchRequest): Promise<ItineraryOption[]>;
}

// TODO: Implement official API adapters behind this interface:
// - SkyscannerAdapter
// - KiwiAdapter
// - DuffelAdapter
// - AmadeusAdapter
// - RyanairOfficialAdapter
// Keep provider auth, rate limits, and response normalization out of UI code.
