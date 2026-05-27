import { mockTrips } from "../mockData";
import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import type { TravelSourceAdapter } from "./baseAdapter";

export class MockTravelAdapter implements TravelSourceAdapter {
  readonly name = "mock";
  readonly mode = "demo";

  isConfigured() {
    return true;
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    try {
      void request;
      return {
        provider: this.name,
        status: "success",
        results: mockTrips,
        warnings: ["Demo provider is enabled. Mock results are not verified real offers."],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mock provider failed";
      return {
        provider: this.name,
        status: "error",
        results: [],
        warnings: [message],
        errorMessage: message,
      };
    }
  }
}
