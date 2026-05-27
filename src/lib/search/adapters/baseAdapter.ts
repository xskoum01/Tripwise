import type { ProviderMode, ProviderName, ProviderSearchResult, TravelSearchRequest } from "../types";

export interface TravelSourceAdapter {
  readonly name: ProviderName;
  readonly mode: ProviderMode;
  isConfigured(): boolean;
  searchTrips(request: TravelSearchRequest): Promise<ProviderSearchResult>;
}

export function skippedProviderResult(provider: ProviderName, warning: string): ProviderSearchResult {
  return {
    provider,
    status: "skipped",
    results: [],
    warnings: [warning],
  };
}

export function errorProviderResult(provider: ProviderName, error: unknown): ProviderSearchResult {
  const message = error instanceof Error ? error.message : "Unknown provider error";

  return {
    provider,
    status: "error",
    results: [],
    warnings: [message],
    errorMessage: message,
  };
}
