import { getServerEnv } from "@/lib/config/env";
import { destinationCoords } from "@/lib/search/destinations";
import type { ItineraryOption, WeatherConfidence } from "@/lib/search/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the number of whole days from today until the given YYYY-MM-DD date. */
function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Open-Meteo forecast API  (≤ 14 days out)
// ---------------------------------------------------------------------------

type ForecastResult = {
  avgTempC: number;
  avgPrecipMm: number;
};

async function fetchForecast(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<ForecastResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo forecast HTTP ${res.status}`);

  const data = await res.json();
  const temps: number[] = data?.daily?.temperature_2m_max ?? [];
  const precips: number[] = data?.daily?.precipitation_sum ?? [];

  if (temps.length === 0) throw new Error("Open-Meteo forecast returned no daily data");

  return {
    avgTempC: average(temps),
    avgPrecipMm: average(precips),
  };
}

// ---------------------------------------------------------------------------
// Open-Meteo climate API  (15 – 365 days out)
// ---------------------------------------------------------------------------

type ClimateResult = {
  avgTempC: number;
  avgPrecipMm?: number;
};

async function fetchClimate(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<ClimateResult> {
  const url = new URL("https://climate-api.open-meteo.com/v1/climate");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("models", "EC_Earth3P_HR");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo climate HTTP ${res.status}`);

  const data = await res.json();
  const temps: number[] = data?.daily?.temperature_2m_max ?? [];
  const precips: number[] = data?.daily?.precipitation_sum ?? [];

  if (temps.length === 0) throw new Error("Open-Meteo climate returned no daily data");

  const result: ClimateResult = { avgTempC: average(temps) };
  if (precips.length > 0) {
    result.avgPrecipMm = average(precips);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function enrichWeather(option: ItineraryOption): Promise<ItineraryOption> {
  const env = getServerEnv();
  if (!env.openMeteoEnabled) {
    return {
      ...option,
      weatherConfidence: option.weatherConfidence ?? "unknown",
    };
  }

  const coords = destinationCoords[option.destinationAirportCode];

  if (!coords) {
    return {
      ...option,
      weatherConfidence: "unknown" as WeatherConfidence,
    };
  }

  const { lat, lng } = coords;
  const departDate = option.dates.depart;
  const returnDate = option.dates.return;
  const daysUntil = getDaysUntil(departDate);

  try {
    if (daysUntil <= 14) {
      // Near-term: use live forecast
      const { avgTempC, avgPrecipMm } = await fetchForecast(lat, lng, departDate, returnDate);
      const warnings = [...(option.warnings ?? [])];
      if (avgPrecipMm > 5) {
        warnings.push("Vyšší srážkový úhrn v tomto termínu.");
      }
      return {
        ...option,
        expectedTemperatureC: Math.round(avgTempC),
        expectedPrecipitationMmPerDay: Math.round(avgPrecipMm * 10) / 10,
        weatherConfidence: "forecast" as WeatherConfidence,
        warnings: warnings.length > 0 ? warnings : option.warnings,
      };
    }

    if (daysUntil <= 365) {
      // Far-future (15 – 365 days): try climate API
      try {
        const { avgTempC, avgPrecipMm } = await fetchClimate(lat, lng, departDate, returnDate);
        return {
          ...option,
          expectedTemperatureC: Math.round(avgTempC),
          ...(avgPrecipMm !== undefined
            ? { expectedPrecipitationMmPerDay: Math.round(avgPrecipMm * 10) / 10 }
            : {}),
          weatherConfidence: "climate" as WeatherConfidence,
        };
      } catch {
        // Climate API failed — fall back to unknown
        return {
          ...option,
          weatherConfidence: "unknown" as WeatherConfidence,
        };
      }
    }

    // daysUntil > 365
    return {
      ...option,
      weatherConfidence: "unknown" as WeatherConfidence,
    };
  } catch {
    return {
      ...option,
      weatherConfidence: option.weatherConfidence ?? "unknown",
    };
  }
}
