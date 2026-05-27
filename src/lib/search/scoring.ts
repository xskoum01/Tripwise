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

function scorePrice(option: ItineraryOption, request: TravelSearchRequest) {
  if (option.totalPrice === undefined) return 45;
  const budget = request.maxBudget ?? 9000;
  if (option.totalPrice <= budget * 0.6) return 100;
  if (option.totalPrice <= budget) return clamp(100 - ((option.totalPrice - budget * 0.6) / (budget * 0.4)) * 35);
  return clamp(58 - ((option.totalPrice - budget) / budget) * 90);
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
  if (request.destinationMode === "warm" && (option.expectedTemperatureC ?? 0) >= (request.minTemperatureC ?? 18)) score += 8;
  if (request.destinationMode !== "any" && request.destinationMode !== "warm" && option.destinationMode !== request.destinationMode) score -= 14;
  return clamp(score);
}

function hasRequestedBaggage(option: ItineraryOption, requested: BaggageOption) {
  return option.baggageIncluded?.some((included) => baggageRank[included] >= baggageRank[requested]) ?? false;
}

function buildWarnings(option: ItineraryOption, request: TravelSearchRequest) {
  const warnings: string[] = [];
  if (!hasRequestedBaggage(option, request.baggage)) warnings.push("Cena nezahrnuje vybrané zavazadlo");
  if (timeToHour(option.departureTime) < 6) warnings.push("Brzký ranní odlet");
  if (!option.direct && option.layoverHours && option.layoverHours >= 4) warnings.push("Delší přestup");
  if (request.maxBudget && option.totalPrice !== undefined && option.totalPrice > request.maxBudget) warnings.push("Nad zadaným rozpočtem");
  if (request.minTemperatureC && (option.expectedTemperatureC ?? 0) < request.minTemperatureC) warnings.push("Nižší teplota než zadání");
  return warnings;
}

function monthLabel(month: number) {
  const labels = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
  return labels[month - 1] ?? "zadaný termín";
}

function buildExplanation(option: ItineraryOption, request: TravelSearchRequest, breakdown: ScoreBreakdown) {
  const reasons = [
    request.targetMonth && option.month === request.targetMonth ? `odpovídá měsíci ${monthLabel(option.month)}` : undefined,
    option.expectedTemperatureC !== undefined ? `má očekávanou teplotu ${option.expectedTemperatureC} °C` : undefined,
    option.destinationMode === "sea" ? "je u moře" : undefined,
    request.maxBudget && option.totalPrice !== undefined && option.totalPrice <= request.maxBudget ? "vejde se do rozpočtu" : undefined,
    option.direct ? "má přímý let" : "má dostupnou návaznost s přestupem",
    breakdown.price >= 82 ? "má silnou cenu" : undefined,
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

  const score = Math.round(
    scoreBreakdown.price * 0.3 +
      scoreBreakdown.comfort * 0.22 +
      scoreBreakdown.timing * 0.18 +
      scoreBreakdown.risk * 0.14 +
      scoreBreakdown.destinationValue * 0.16,
  );

  return {
    ...option,
    score: clamp(score),
    scoreBreakdown,
    explanation: buildExplanation(option, request, scoreBreakdown),
    warnings: buildWarnings(option, request),
  };
}
