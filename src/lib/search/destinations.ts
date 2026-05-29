import type { DestinationMode } from "./types";

export type DestinationCoords = {
  lat: number;
  lng: number;
};

/**
 * Approximate airport/city coordinates for MVP destinations.
 * Used by the weather service to call Open-Meteo forecast and climate APIs.
 */
export const destinationCoords: Record<string, DestinationCoords> = {
  AGP: { lat: 36.68, lng: -4.50 },   // Málaga
  ALC: { lat: 38.28, lng: -0.56 },   // Alicante
  BCN: { lat: 41.30, lng: 2.08 },    // Barcelona
  PMI: { lat: 39.55, lng: 2.74 },    // Mallorca
  MLA: { lat: 35.86, lng: 14.48 },   // Malta
  LCA: { lat: 34.87, lng: 33.63 },   // Larnaka
  TFS: { lat: 28.04, lng: -16.57 },  // Tenerife Sur
  LPA: { lat: 27.93, lng: -15.39 },  // Gran Canaria
  FNC: { lat: 32.69, lng: -16.78 },  // Madeira
  NCE: { lat: 43.66, lng: 7.21 },    // Nice
  SPU: { lat: 43.54, lng: 16.30 },   // Split
  DBV: { lat: 42.56, lng: 18.27 },   // Dubrovnik
  ZAD: { lat: 44.08, lng: 15.35 },   // Zadar
  FCO: { lat: 41.80, lng: 12.25 },   // Rome FCO
  CIA: { lat: 41.80, lng: 12.59 },   // Rome Ciampino
  BGY: { lat: 45.67, lng: 9.70 },    // Milan Bergamo
  MXP: { lat: 45.63, lng: 8.72 },    // Milan Malpensa
  ATH: { lat: 37.93, lng: 23.95 },   // Athens
  SKG: { lat: 40.52, lng: 22.97 },   // Thessaloniki
  CTA: { lat: 37.47, lng: 15.07 },   // Catania
  PMO: { lat: 38.18, lng: 13.10 },   // Palermo
  VLC: { lat: 39.49, lng: -0.48 },   // Valencia
  FAO: { lat: 37.02, lng: -7.97 },   // Faro
  LIS: { lat: 38.77, lng: -9.13 },   // Lisbon
  OPO: { lat: 41.24, lng: -8.68 },   // Porto
  SVQ: { lat: 37.42, lng: -5.89 },   // Seville
  NAP: { lat: 40.88, lng: 14.29 },   // Naples
  TIA: { lat: 41.42, lng: 19.72 },   // Tirana
  SKP: { lat: 41.96, lng: 21.63 },   // Skopje
  SOF: { lat: 42.70, lng: 23.41 },   // Sofia
  OTP: { lat: 44.57, lng: 26.08 },   // Bucharest
  BOJ: { lat: 42.57, lng: 27.52 },   // Burgas
  VAR: { lat: 43.23, lng: 27.83 },   // Varna
  HRG: { lat: 27.18, lng: 33.80 },   // Hurghada
  RMF: { lat: 25.55, lng: 34.59 },   // Marsa Alam
  AYT: { lat: 36.90, lng: 30.80 },   // Antalya
};

export type SearchDestination = {
  code: string;
  city: string;
  country: string;
  modes: DestinationMode[];
  aliases: string[];
  lat?: number;
  lng?: number;
};

export const mvpDestinations: SearchDestination[] = [
  { code: "AGP", city: "Málaga", country: "Španělsko", modes: ["sea", "warm"], aliases: ["malaga", "malaga", "agp"], lat: 36.68, lng: -4.50 },
  { code: "ALC", city: "Alicante", country: "Španělsko", modes: ["sea", "warm"], aliases: ["alicante", "alc"], lat: 38.28, lng: -0.56 },
  { code: "BCN", city: "Barcelona", country: "Španělsko", modes: ["sea", "warm", "cityBreak"], aliases: ["barcelona", "bcn"], lat: 41.30, lng: 2.08 },
  { code: "PMI", city: "Mallorca", country: "Španělsko", modes: ["sea", "warm"], aliases: ["mallorca", "palma", "pmi"], lat: 39.55, lng: 2.74 },
  { code: "MLA", city: "Malta", country: "Malta", modes: ["sea", "warm"], aliases: ["malta", "mla"], lat: 35.86, lng: 14.48 },
  { code: "LCA", city: "Larnaka", country: "Kypr", modes: ["sea", "warm"], aliases: ["larnaka", "larnaca", "kypr", "cyprus", "lca"], lat: 34.87, lng: 33.63 },
  { code: "TFS", city: "Tenerife", country: "Kanárské ostrovy", modes: ["sea", "warm"], aliases: ["tenerife", "tfs"], lat: 28.04, lng: -16.57 },
  { code: "LPA", city: "Gran Canaria", country: "Kanárské ostrovy", modes: ["sea", "warm"], aliases: ["gran canaria", "kanary", "lpa"], lat: 27.93, lng: -15.39 },
  { code: "FNC", city: "Madeira", country: "Portugalsko", modes: ["sea", "warm"], aliases: ["madeira", "fnc"], lat: 32.69, lng: -16.78 },
  { code: "NCE", city: "Nice", country: "Francie", modes: ["sea", "cityBreak"], aliases: ["nice", "nce"], lat: 43.66, lng: 7.21 },
  { code: "SPU", city: "Split", country: "Chorvatsko", modes: ["sea"], aliases: ["split", "chorvatsko", "spu"], lat: 43.54, lng: 16.30 },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function resolveMvpDestinations(wish: string, mode: DestinationMode) {
  const normalizedWish = normalize(wish);
  const exact = mvpDestinations.find((destination) => destination.aliases.some((alias) => normalizedWish.includes(normalize(alias))));
  if (exact) return { destinations: [exact], limitedToMvpSet: false };

  if (mode === "sea" || mode === "warm") {
    return {
      destinations: mvpDestinations.filter((destination) => destination.modes.includes(mode) || destination.modes.includes("sea")),
      limitedToMvpSet: true,
    };
  }

  if (mode === "cityBreak") {
    return {
      destinations: mvpDestinations.filter((destination) => destination.modes.includes("cityBreak")),
      limitedToMvpSet: true,
    };
  }

  return {
    destinations: mvpDestinations,
    limitedToMvpSet: true,
  };
}
