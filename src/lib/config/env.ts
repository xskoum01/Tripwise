export type ServerEnv = {
  skyscannerApiKey?: string;
  skyscannerMarket: string;
  skyscannerLocale: string;
  skyscannerCurrency: string;
  duffelAccessToken?: string;
  kiwiApiKey?: string;
  enableMockProvider: boolean;
  openMeteoEnabled: boolean;
};

function enabled(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

export function getServerEnv(): ServerEnv {
  return {
    skyscannerApiKey: process.env.SKYSCANNER_API_KEY,
    skyscannerMarket: process.env.SKYSCANNER_MARKET ?? "CZ",
    skyscannerLocale: process.env.SKYSCANNER_LOCALE ?? "cs-CZ",
    skyscannerCurrency: process.env.SKYSCANNER_CURRENCY ?? "CZK",
    duffelAccessToken: process.env.DUFFEL_ACCESS_TOKEN,
    kiwiApiKey: process.env.KIWI_API_KEY,
    enableMockProvider: enabled(process.env.ENABLE_MOCK_PROVIDER, false),
    openMeteoEnabled: enabled(process.env.OPEN_METEO_ENABLED, true),
  };
}
