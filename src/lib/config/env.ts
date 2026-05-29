export type DuffelMode = "test" | "live";

export type ServerEnv = {
  skyscannerApiKey?: string;
  skyscannerMarket: string;
  skyscannerLocale: string;
  skyscannerCurrency: string;
  duffelAccessToken?: string;
  duffelMode?: DuffelMode;
  showDuffelTestResults: boolean;
  kiwiApiKey?: string;
  kiwiApiKeySource?: string;
  enableMockProvider: boolean;
  openMeteoEnabled: boolean;
  enableRyanairUnofficial: boolean;
  allowUnofficialInProduction: boolean;
  enableAirlineSearchLinks: boolean;
};

function enabled(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

// Detect Duffel token type from prefix.
// Test tokens start with "duffel_test_", live tokens with "duffel_live_".
// Unknown formats are treated as live to avoid false sandbox classification.
function detectDuffelMode(token: string | undefined): DuffelMode | undefined {
  if (!token) return undefined;
  if (token.startsWith("duffel_test_")) return "test";
  return "live";
}

/**
 * Resolve Kiwi/Tequila API key from multiple possible environment variable names.
 * Supports legacy naming from old Python implementation and alternative conventions.
 * Returns tuple of [key, sourceVarName] for diagnostics.
 */
function resolveKiwiApiKey(): [string | undefined, string | undefined] {
  // Priority order: KIWI_API_KEY (current), TEQUILA_API_KEY (alternative), KIWI_TEQUILA_API_KEY (legacy)
  const candidates = [
    { name: "KIWI_API_KEY", value: process.env.KIWI_API_KEY },
    { name: "TEQUILA_API_KEY", value: process.env.TEQUILA_API_KEY },
    { name: "KIWI_TEQUILA_API_KEY", value: process.env.KIWI_TEQUILA_API_KEY },
  ];

  for (const candidate of candidates) {
    if (candidate.value) {
      return [candidate.value, candidate.name];
    }
  }

  return [undefined, undefined];
}

export function getServerEnv(): ServerEnv {
  const [kiwiApiKey, kiwiApiKeySource] = resolveKiwiApiKey();
  const duffelAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
  const duffelMode = detectDuffelMode(duffelAccessToken);

  return {
    skyscannerApiKey: process.env.SKYSCANNER_API_KEY,
    skyscannerMarket: process.env.SKYSCANNER_MARKET ?? "CZ",
    skyscannerLocale: process.env.SKYSCANNER_LOCALE ?? "cs-CZ",
    skyscannerCurrency: process.env.SKYSCANNER_CURRENCY ?? "CZK",
    duffelAccessToken,
    duffelMode,
    showDuffelTestResults: enabled(process.env.SHOW_DUFFEL_TEST_RESULTS, false),
    kiwiApiKey,
    kiwiApiKeySource,
    enableMockProvider: enabled(process.env.ENABLE_MOCK_PROVIDER, false),
    openMeteoEnabled: enabled(process.env.OPEN_METEO_ENABLED, true),
    enableRyanairUnofficial: enabled(process.env.ENABLE_RYANAIR_UNOFFICIAL_PROVIDER, false),
    allowUnofficialInProduction: enabled(process.env.ALLOW_UNOFFICIAL_PROVIDERS_IN_PRODUCTION, false),
    enableAirlineSearchLinks: enabled(process.env.ENABLE_AIRLINE_SEARCH_LINKS, true),
  };
}
