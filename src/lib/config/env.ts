export type ServerEnv = {
  skyscannerApiKey?: string;
  skyscannerMarket: string;
  skyscannerLocale: string;
  skyscannerCurrency: string;
  duffelAccessToken?: string;
  kiwiApiKey?: string;
  kiwiApiKeySource?: string;
  enableMockProvider: boolean;
  openMeteoEnabled: boolean;
};

function enabled(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
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

  return {
    skyscannerApiKey: process.env.SKYSCANNER_API_KEY,
    skyscannerMarket: process.env.SKYSCANNER_MARKET ?? "CZ",
    skyscannerLocale: process.env.SKYSCANNER_LOCALE ?? "cs-CZ",
    skyscannerCurrency: process.env.SKYSCANNER_CURRENCY ?? "CZK",
    duffelAccessToken: process.env.DUFFEL_ACCESS_TOKEN,
    kiwiApiKey,
    kiwiApiKeySource,
    enableMockProvider: enabled(process.env.ENABLE_MOCK_PROVIDER, false),
    openMeteoEnabled: enabled(process.env.OPEN_METEO_ENABLED, true),
  };
}
