import type { ServerEnv } from "@/lib/config/env";
import type { ProviderSearchResult, TravelSearchRequest } from "../types";
import { skippedProviderResult, type TravelSourceAdapter } from "./baseAdapter";

export class KiwiAdapter implements TravelSourceAdapter {
  readonly name = "kiwi";
  readonly mode = "verified";

  constructor(private readonly env: ServerEnv) {}

  isConfigured() {
    return Boolean(this.env.kiwiApiKey);
  }

  async searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult> {
    if (!this.isConfigured()) {
      return skippedProviderResult(this.name, "KIWI_API_KEY is not configured; Kiwi/Tequila results skipped.");
    }

    void request;

    // TODO: Implement only against an official Kiwi/Tequila API contract available to this app.
    // Do not use unofficial scraping. Mark results verified only when they come from an official API response.
    return {
      provider: this.name,
      status: "skipped",
      results: [],
      warnings: ["Kiwi adapter is configured but official API integration is not implemented yet."],
    };
  }
}
