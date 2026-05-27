import type { ItineraryOption, ScoreBreakdown } from "@/lib/search/types";

const scoreLabels: Record<keyof ScoreBreakdown, string> = {
  price: "cena",
  comfort: "pohodlí",
  timing: "dobré časy",
  risk: "spolehlivost",
  destinationValue: "destinace",
};

export function buildStrengths(trip: ItineraryOption, limit = 3) {
  const breakdown = trip.scoreBreakdown;
  if (!breakdown) return trip.direct ? ["přímý let"] : ["dobrá celková hodnota"];

  const ranked = (Object.entries(breakdown) as Array<[keyof ScoreBreakdown, number]>)
    .filter(([, value]) => value >= 78)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => scoreLabels[key]);

  if (trip.direct && !ranked.includes("přímý let")) ranked.unshift("přímý let");

  return ranked.slice(0, limit);
}

export function buildScoreSummary(trip: ItineraryOption) {
  const strengths = buildStrengths(trip).join(", ");
  return `Silné: ${strengths || "vyvážená cena a dostupnost"}`;
}

export function buildWarningSummary(trip: ItineraryOption) {
  return trip.warnings?.[0] ? `Pozor: ${trip.warnings[0]}` : "Pozor: bez zásadního omezení";
}
