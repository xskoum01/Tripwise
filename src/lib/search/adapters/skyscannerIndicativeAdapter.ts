import type { ServerEnv } from "@/lib/config/env";
import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

export class SkyscannerIndicativeAdapter implements TravelSourceAdapter {
  readonly name = "skyscanner-indicative";
  readonly mode = "indicative";

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.skyscannerApiKey);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "SKYSCANNER_API_KEY is not configured; indicative Skyscanner results skipped.");
    }

    void request;

    // TODO: Wire official Skyscanner Indicative Prices API for inspiration flows:
    // month-wide searches, flexible destinations, "kamkoliv", and lowest-price discovery.
    // Normalize as availabilityStatus="indicative", priceStatus="cached", linkType="search".
    return {
      provider: this.name,
      status: "skipped",
      results: [],
      warnings: ["Skyscanner Indicative adapter is configured but the API contract is not completed yet."],
    };
  }
}
