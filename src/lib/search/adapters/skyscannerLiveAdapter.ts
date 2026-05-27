import type { ServerEnv } from "@/lib/config/env";
import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

export class SkyscannerLiveAdapter implements TravelSourceAdapter {
  readonly name = "skyscanner-live";
  readonly mode = "verified";

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.skyscannerApiKey);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "SKYSCANNER_API_KEY is not configured; live Skyscanner results skipped.");
    }

    void request;

    // TODO: Complete against the contracted Skyscanner Flights Live Prices API:
    // 1. Create a live search session with market/locale/currency and exact origin/date slices.
    // 2. Poll the session until completed or timeout.
    // 3. Normalize returned itineraries with provider deep links:
    //    availabilityStatus="verified", priceStatus="live", linkType="exact".
    // This skeleton deliberately returns no results until the API contract is wired and tested.
    return {
      provider: this.name,
      status: "skipped",
      results: [],
      warnings: ["Skyscanner Live adapter is configured but the API contract is not completed yet."],
    };
  }
}
