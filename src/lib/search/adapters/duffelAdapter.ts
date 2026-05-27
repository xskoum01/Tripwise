import type { ServerEnv } from "@/lib/config/env";
import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

export class DuffelAdapter implements TravelSourceAdapter {
  readonly name = "duffel";
  readonly mode = "verified";

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.duffelAccessToken);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "DUFFEL_ACCESS_TOKEN is not configured; Duffel offers skipped.");
    }

    void request;

    // TODO: Implement Duffel offer request flow for exact origin/destination/date slices.
    // Normalize usable offers as availabilityStatus="verified", priceStatus="live".
    // Only use linkType="exact" when the offer can be directly opened or selected.
    // Before booking, selected offer must be re-fetched because offers can become stale.
    return {
      provider: this.name,
      status: "skipped",
      results: [],
      warnings: ["Duffel adapter is configured but offer search is not implemented yet."],
    };
  }
}
