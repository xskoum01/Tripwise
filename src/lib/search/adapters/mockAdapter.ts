import { mockTrips } from "../mockData";
import type { ItineraryOption, TravelSearchRequest } from "../types";
import type { TravelSourceAdapter } from "./baseAdapter";

export class MockTravelAdapter implements TravelSourceAdapter {
  readonly name = "MockTravelAdapter";

  async searchTrips(request: TravelSearchRequest): Promise<ItineraryOption[]> {
    void request;
    return mockTrips;
  }
}
