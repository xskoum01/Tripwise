import type { BaggageOption, ItineraryOption, ScoreBreakdown, TravelSearchRequest } from "./types";

const baggageRank: Record<BaggageOption, number> = {
  backpack: 1,
  cabin: 2,
  checked: 3,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function timeToHour(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
}

/**
 * Returns the effective price used for scoring.
 * When totalTripEstimateCzk is defined it is used as the comparison price so that
 * expensive airport-access or accommodation is factored in. Otherwise falls back
 * to the flight-only priceCzk / totalPrice.
 */
function effectivePrice(option: ItineraryOption): number | undefined {
  if (option.totalTripEstimateCzk !== undefined) return option.totalTripEstimateCzk;
  return option.priceCzk ?? option.totalPrice;
}

function scorePrice(option: ItineraryOption, request: TravelSearchRequest) {
  const price = effectivePrice(option);
  if (price === undefined) return 45;
  const budget = request.maxBudget ?? 9000;
  if (price <= budget * 0.6) return 100;
  if (price <= budget) return clamp(100 - ((price - budget * 0.6) / (budget * 0.4)) * 35);
  return clamp(58 - ((price - budget) / budget) * 90);
}

function scoreComfort(option: ItineraryOption, request: TravelSearchRequest) {
  let score = option.direct ? 92 : 72;
  if (option.layoverHours) score -= Math.min(32, option.layoverHours * 5);
  if (!hasRequestedBaggage(option, request.baggage)) score -= 8;
  return clamp(score);
}

function scoreTiming(option: ItineraryOption, request: TravelSearchRequest) {
  let score = 88;
  const departureHour = timeToHour(option.departureTime);
  const returnHour = timeToHour(option.returnTime);

  if (departureHour < 6) score -= request.avoidEarlyFlights ? 38 : 20;
  if (departureHour >= 6 && departureHour < 7) score -= request.avoidEarlyFlights ? 20 : 9;
  if (returnHour < 10 || returnHour > 22) score -= 10;
  if (request.weekendOnly) score = (score + option.weekendFit) / 2;

  return clamp(score);
}

function scoreRisk(option: ItineraryOption) {
  let score = option.reliability;
  if (!option.direct) score -= 10;
  if (option.layoverHours && option.layoverHours > 4) score -= 12;
  return clamp(score);
}

function scoreDestinationValue(option: ItineraryOption, request: TravelSearchRequest) {
  let score = option.destinationValue;
  if (request.destinationMode !== "any" && option.destinationMode === request.destinationMode) score += 8;
  // Temperature bonus: keep existing logic (max +8), but the penalty below is always larger (40+).
  if (request.destinationMode === "warm" && (option.expectedTemperatureC ?? 0) >= (request.minTemperatureC ?? 18)) score += 8;
  if (request.destinationMode !== "any" && request.destinationMode !== "warm" && option.destinationMode !== request.destinationMode) score -= 14;
  return clamp(score);
}

function hasRequestedBaggage(option: ItineraryOption, requested: BaggageOption) {
  return option.baggageIncluded?.some((included) => baggageRank[included] >= baggageRank[requested]) ?? false;
}

/**
 * Computes a temperature penalty to subtract directly from the final weighted score.
 * Returns { penalty, warning } where penalty >= 0 (amount to subtract) and warning is
 * a Czech-language string or undefined.
 */
function computeTemperaturePenalty(
  option: ItineraryOption,
  request: TravelSearchRequest,
): { penalty: number; warning: string | undefined } {
  if (!request.minTemperatureC) return { penalty: 0, warning: undefined };

  const confidence = option.weatherConfidence ?? "unknown";

  // Unknown confidence: soft penalty + informational warning, no hard filter.
  if (confidence === "unknown") {
    return {
      penalty: 7,
      warning: "Počasí pro tento termín není ověřené — teplota neznámá.",
    };
  }

  // forecast or climate: apply hard scaling penalty when below threshold.
  if (confidence === "forecast" || confidence === "climate") {
    if (option.expectedTemperatureC === undefined) return { penalty: 0, warning: undefined };

    const deficit = request.minTemperatureC - option.expectedTemperatureC;
    if (deficit <= 0) return { penalty: 0, warning: undefined };

    // Base penalty 40 points, plus 3 extra points per degree below threshold.
    const penalty = 40 + deficit * 3;
    const warning = `Nesplňuje požadavek na teplotu: očekáváno ${option.expectedTemperatureC}°C, požadováno min. ${request.minTemperatureC}°C.`;
    return { penalty, warning };
  }

  return { penalty: 0, warning: undefined };
}

/**
 * Computes a precipitation / rain penalty to subtract directly from the final weighted score.
 * Returns { penalty, warning } where penalty >= 0 (amount to subtract) and warning is
 * a Czech-language string or undefined.
 *
 * Only active when request.weatherPreference is "no-rain" or "sunny".
 * "sunny" applies 50 % of the "no-rain" penalty values.
 */
function computeRainPenalty(
  option: ItineraryOption,
  request: TravelSearchRequest,
): { penalty: number; warning: string | undefined } {
  const pref = request.weatherPreference;
  if (pref !== "no-rain" && pref !== "sunny") return { penalty: 0, warning: undefined };

  const factor = pref === "sunny" ? 0.5 : 1;

  const precip = option.expectedPrecipitationMmPerDay;

  // Precipitation data is unavailable.
  if (precip === undefined) {
    return {
      penalty: Math.round(5 * factor),
      warning: "Srážky pro tento termín nejsou ověřené.",
    };
  }

  // Strong penalty: > 8 mm/day.
  if (precip > 8) {
    return {
      penalty: Math.round(35 * factor),
      warning: `Nesplňuje požadavek bez deště: očekávané srážky ${precip} mm/den.`,
    };
  }

  // Moderate penalty: 4–8 mm/day (inclusive of 4, exclusive of lower bound above).
  if (precip >= 4) {
    return {
      penalty: Math.round(15 * factor),
      warning: `Vyšší srážky: ${precip} mm/den.`,
    };
  }

  // < 4 mm/day — no penalty.
  return { penalty: 0, warning: undefined };
}

function buildWarnings(option: ItineraryOption, request: TravelSearchRequest): string[] {
  const warnings: string[] = [];
  if (!hasRequestedBaggage(option, request.baggage)) warnings.push("Cena nezahrnuje vybrané zavazadlo");
  if (timeToHour(option.departureTime) < 6) warnings.push("Brzký ranní odlet");
  if (!option.direct && option.layoverHours && option.layoverHours >= 4) warnings.push("Delší přestup");

  // Use effectivePrice for budget comparison so that trip-level totals are checked against budget.
  const priceForBudget = effectivePrice(option);
  if (request.maxBudget && priceForBudget !== undefined && priceForBudget > request.maxBudget) warnings.push("Nad zadaným rozpočtem");

  // Temperature warnings are now generated by computeTemperaturePenalty; include them here
  // so buildWarnings remains the single source of truth for the returned warnings array.
  const { warning: tempWarning } = computeTemperaturePenalty(option, request);
  if (tempWarning) warnings.push(tempWarning);

  // Rain/precipitation warnings.
  const { warning: rainWarning } = computeRainPenalty(option, request);
  if (rainWarning) warnings.push(rainWarning);

  return warnings;
}

function monthLabel(month: number) {
  const labels = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
  return labels[month - 1] ?? "zadaný termín";
}

function buildExplanation(option: ItineraryOption, request: TravelSearchRequest, breakdown: ScoreBreakdown) {
  const tempPenalty = computeTemperaturePenalty(option, request);
  const rainPenalty = computeRainPenalty(option, request);

  // Weather reasoning clauses.
  const weatherReasons: string[] = [];

  if (tempPenalty.penalty > 0 && option.expectedTemperatureC !== undefined && request.minTemperatureC !== undefined) {
    // Hard temperature miss — always mention it when we have concrete numbers.
    weatherReasons.push(`Nesplňuje požadavek na teplotu: ${option.expectedTemperatureC} °C < ${request.minTemperatureC} °C`);
  }

  if (rainPenalty.penalty > 0 && option.expectedPrecipitationMmPerDay !== undefined) {
    weatherReasons.push(`Déšť může být problém: očekáváno ${option.expectedPrecipitationMmPerDay} mm/den`);
  }

  // Positive temperature confirmation: passes temp check and precipitation is low.
  const tempOk =
    tempPenalty.penalty === 0 &&
    option.expectedTemperatureC !== undefined &&
    request.minTemperatureC !== undefined &&
    option.expectedTemperatureC >= request.minTemperatureC;
  const precipOk = (option.expectedPrecipitationMmPerDay ?? 0) < 4;

  if (tempOk && precipOk && weatherReasons.length === 0) {
    weatherReasons.push(`Splňuje požadavek na teplo: ${option.expectedTemperatureC} °C`);
  }

  // Trip cost estimate clauses.
  const costReasons: string[] = [];

  const originAccess = option.tripCostEstimate?.originAccessCostCzk;
  if (originAccess !== undefined && originAccess > 600) {
    costReasons.push(`Dražší přístup na letiště (${Math.round(originAccess)} Kč).`);
  }

  if (option.totalTripEstimateCzk !== undefined) {
    costReasons.push(`Celkový odhad výletu: ${Math.round(option.totalTripEstimateCzk)} Kč.`);
  }

  const accommodation = option.tripCostEstimate?.accommodationEstimateCzk;
  if (accommodation !== undefined) {
    costReasons.push(`Z toho ubytování odhad: ${Math.round(accommodation)} Kč.`);
  }

  const reasons = [
    request.targetMonth && option.month === request.targetMonth ? `odpovídá měsíci ${monthLabel(option.month)}` : undefined,
    option.expectedTemperatureC !== undefined && weatherReasons.length === 0 ? `má očekávanou teplotu ${option.expectedTemperatureC} °C` : undefined,
    option.destinationMode === "sea" ? "je u moře" : undefined,
    request.maxBudget && option.totalPrice !== undefined && option.totalPrice <= request.maxBudget ? "vejde se do rozpočtu" : undefined,
    option.direct ? "má přímý let" : "má dostupnou návaznost s přestupem",
    breakdown.price >= 82 ? "má silnou cenu" : undefined,
    ...weatherReasons,
    ...costReasons,
  ].filter(Boolean);

  return `Doporučujeme, protože ${reasons.join(", ")}.`;
}

export function scoreItinerary(option: ItineraryOption, request: TravelSearchRequest): ItineraryOption {
  const scoreBreakdown: ScoreBreakdown = {
    price: Math.round(scorePrice(option, request)),
    comfort: Math.round(scoreComfort(option, request)),
    timing: Math.round(scoreTiming(option, request)),
    risk: Math.round(scoreRisk(option)),
    destinationValue: Math.round(scoreDestinationValue(option, request)),
  };

  const weightedScore =
    scoreBreakdown.price * 0.3 +
    scoreBreakdown.comfort * 0.22 +
    scoreBreakdown.timing * 0.18 +
    scoreBreakdown.risk * 0.14 +
    scoreBreakdown.destinationValue * 0.16;

  // Apply temperature penalty after the weighted composite so it can't be
  // offset by high sub-scores in other dimensions.
  const { penalty: tempPenalty } = computeTemperaturePenalty(option, request);

  // Apply rain / precipitation penalty after the weighted composite for the same reason.
  const { penalty: rainPenalty } = computeRainPenalty(option, request);

  const score = clamp(Math.round(weightedScore - tempPenalty - rainPenalty));

  const warnings = buildWarnings(option, request);

  return {
    ...option,
    score,
    scoreBreakdown,
    explanation: buildExplanation(option, request, scoreBreakdown),
    warnings,
  };
}
