import type { DestinationMode } from "./types";

export type SearchDestination = {
  code: string;
  city: string;
  country: string;
  modes: DestinationMode[];
  aliases: string[];
};

export const mvpDestinations: SearchDestination[] = [
  { code: "AGP", city: "Málaga", country: "Španělsko", modes: ["sea", "warm"], aliases: ["malaga", "malaga", "agp"] },
  { code: "ALC", city: "Alicante", country: "Španělsko", modes: ["sea", "warm"], aliases: ["alicante", "alc"] },
  { code: "BCN", city: "Barcelona", country: "Španělsko", modes: ["sea", "warm", "cityBreak"], aliases: ["barcelona", "bcn"] },
  { code: "PMI", city: "Mallorca", country: "Španělsko", modes: ["sea", "warm"], aliases: ["mallorca", "palma", "pmi"] },
  { code: "MLA", city: "Malta", country: "Malta", modes: ["sea", "warm"], aliases: ["malta", "mla"] },
  { code: "LCA", city: "Larnaka", country: "Kypr", modes: ["sea", "warm"], aliases: ["larnaka", "larnaca", "kypr", "cyprus", "lca"] },
  { code: "TFS", city: "Tenerife", country: "Kanárské ostrovy", modes: ["sea", "warm"], aliases: ["tenerife", "tfs"] },
  { code: "LPA", city: "Gran Canaria", country: "Kanárské ostrovy", modes: ["sea", "warm"], aliases: ["gran canaria", "kanary", "lpa"] },
  { code: "FNC", city: "Madeira", country: "Portugalsko", modes: ["sea", "warm"], aliases: ["madeira", "fnc"] },
  { code: "NCE", city: "Nice", country: "Francie", modes: ["sea", "cityBreak"], aliases: ["nice", "nce"] },
  { code: "SPU", city: "Split", country: "Chorvatsko", modes: ["sea"], aliases: ["split", "chorvatsko", "spu"] },
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
