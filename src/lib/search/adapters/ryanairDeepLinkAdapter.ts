import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import type { TravelSourceAdapter } from "./baseAdapter";

export class RyanairDeepLinkAdapter implements TravelSourceAdapter {
  readonly name = "ryanair-deeplink";
  readonly mode = "search";

  isConfigured() {
    return true;
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    void request;

    return {
      provider: this.name,
      status: "skipped",
      results: [],
      warnings: ["Ryanair adapter generates search links only after another source finds an itinerary. It never scrapes or verifies Ryanair availability."],
    };
  }
}
