import { getServerEnv } from "@/lib/config/env";
import type { ItineraryOption, WeatherConfidence } from "@/lib/search/types";

const destinationClimate: Record<string, number> = {
  AGP: 22,
  BCN: 23,
  CPH: 16,
  FNC: 20,
  LCA: 24,
  LPA: 23,
  MLA: 22,
  NCE: 21,
  SPU: 23,
  TFS: 23,
};

function climateEstimate(destinationAirportCode: string | undefined) {
  if (!destinationAirportCode) return undefined;
  return destinationClimate[destinationAirportCode];
}

export async function enrichWeather(option: ItineraryOption): Promise<ItineraryOption> {
  const env = getServerEnv();
  if (!env.openMeteoEnabled) {
    return {
      ...option,
      weatherConfidence: option.weatherConfidence ?? "unknown",
    };
  }

  try {
    const estimate = option.expectedTemperatureC ?? climateEstimate(option.destinationAirportCode);
    const confidence: WeatherConfidence = option.expectedTemperatureC ? option.weatherConfidence ?? "climate" : estimate ? "climate" : "unknown";

    // TODO: Add destination coordinates and call Open-Meteo forecast API for near-term trips.
    // Far-future MVP searches use deterministic climate estimates instead of failing the search.
    return {
      ...option,
      expectedTemperatureC: estimate,
      weatherConfidence: confidence,
    };
  } catch {
    return {
      ...option,
      weatherConfidence: option.weatherConfidence ?? "unknown",
    };
  }
}
