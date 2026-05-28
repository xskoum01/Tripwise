import { getServerEnv } from "@/lib/config/env";
import type { ProviderStatus } from "@/lib/search/types";

export function getProviderStatuses(): ProviderStatus[] {
  const env = getServerEnv();
  const isDevelopment = process.env.NODE_ENV !== "production";

  return [
    {
      name: "skyscanner-live",
      configured: Boolean(env.skyscannerApiKey),
      enabled: Boolean(env.skyscannerApiKey),
      mode: "verified",
      message: env.skyscannerApiKey ? "Skyscanner Live Prices API key configured." : "Set SKYSCANNER_API_KEY to enable verified live flight results.",
    },
    {
      name: "skyscanner-indicative",
      configured: Boolean(env.skyscannerApiKey),
      enabled: Boolean(env.skyscannerApiKey),
      mode: "indicative",
      message: env.skyscannerApiKey ? "Skyscanner Indicative Prices can be used for inspiration results." : "Set SKYSCANNER_API_KEY to enable indicative inspiration results.",
    },
    {
      name: "duffel",
      configured: Boolean(env.duffelAccessToken),
      enabled: Boolean(env.duffelAccessToken),
      mode: "verified",
      message: env.duffelAccessToken ? "Duffel token configured for offer search." : "Set DUFFEL_ACCESS_TOKEN to enable Duffel offers.",
    },
    {
      name: "kiwi",
      configured: Boolean(env.kiwiApiKey),
      enabled: Boolean(env.kiwiApiKey),
      mode: "verified",
      message: env.kiwiApiKey
        ? `Kiwi/Tequila key configured via ${env.kiwiApiKeySource}; live search enabled.`
        : "No Kiwi/Tequila key found (KIWI_API_KEY, TEQUILA_API_KEY, KIWI_TEQUILA_API_KEY); live search disabled.",
      ...(isDevelopment && {
        diagnostics: {
          keyLength: env.kiwiApiKey?.length ?? 0,
          envVarName: env.kiwiApiKeySource,
        },
      }),
    },
    {
      name: "ryanair-deeplink",
      configured: true,
      enabled: true,
      mode: "search",
      message: "Generates search links only. It never verifies Ryanair availability and never scrapes.",
    },
    {
      name: "open-meteo",
      configured: env.openMeteoEnabled,
      enabled: env.openMeteoEnabled,
      mode: "enrichment",
      message: env.openMeteoEnabled ? "Weather enrichment is enabled." : "Set OPEN_METEO_ENABLED=true to enable weather enrichment.",
    },
    {
      name: "mock",
      configured: env.enableMockProvider,
      enabled: env.enableMockProvider,
      mode: "demo",
      message: env.enableMockProvider ? "Demo mock provider enabled. Results are not real offers." : "Set ENABLE_MOCK_PROVIDER=true to show explicit demo data.",
    },
  ];
}
