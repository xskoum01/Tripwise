import { AIRPORT_COST_PROFILES } from "./airports";
import type { ItineraryOption } from "./types";

export type TripCostEstimate = {
  flightPriceCzk?: number;
  originAccessCostCzk?: number;
  destinationTransferCostCzk?: number;
  accommodationEstimateCzk?: number;
  totalEstimateCzk?: number;
  nights?: number;
  confidence: "low" | "medium";
  notes: string[];
};

type DestinationCostProfile = {
  airportCode: string;
  transferCostCzk: number;
  nightlyAccommodationEstimateCzk: number;
  localPriceLevel: "low" | "medium" | "high";
  costNote?: string;
};

const DESTINATION_COST_PROFILES: Record<string, DestinationCostProfile> = {
  // Spain / Portugal
  AGP: { airportCode: "AGP", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  ALC: { airportCode: "ALC", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  BCN: { airportCode: "BCN", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  PMI: { airportCode: "PMI", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  VLC: { airportCode: "VLC", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  FAO: { airportCode: "FAO", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  LIS: { airportCode: "LIS", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  OPO: { airportCode: "OPO", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  SVQ: { airportCode: "SVQ", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1500, localPriceLevel: "medium" },
  // Italy
  FCO: { airportCode: "FCO", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  CIA: { airportCode: "CIA", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  BGY: { airportCode: "BGY", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  MXP: { airportCode: "MXP", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  NAP: { airportCode: "NAP", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  CTA: { airportCode: "CTA", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  PMO: { airportCode: "PMO", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  // Nice
  NCE: { airportCode: "NCE", transferCostCzk: 600, nightlyAccommodationEstimateCzk: 1800, localPriceLevel: "high" },
  // Croatia
  SPU: { airportCode: "SPU", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1100, localPriceLevel: "medium" },
  DBV: { airportCode: "DBV", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1100, localPriceLevel: "medium" },
  ZAD: { airportCode: "ZAD", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1100, localPriceLevel: "medium" },
  // Greece
  ATH: { airportCode: "ATH", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1300, localPriceLevel: "medium" },
  SKG: { airportCode: "SKG", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1300, localPriceLevel: "medium" },
  // Albania / North Macedonia
  TIA: { airportCode: "TIA", transferCostCzk: 300, nightlyAccommodationEstimateCzk: 800,  localPriceLevel: "low" },
  SKP: { airportCode: "SKP", transferCostCzk: 300, nightlyAccommodationEstimateCzk: 800,  localPriceLevel: "low" },
  // Bulgaria
  SOF: { airportCode: "SOF", transferCostCzk: 350, nightlyAccommodationEstimateCzk: 900,  localPriceLevel: "low" },
  // Romania
  OTP: { airportCode: "OTP", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1000, localPriceLevel: "low" },
  // Bulgaria coast
  BOJ: { airportCode: "BOJ", transferCostCzk: 350, nightlyAccommodationEstimateCzk: 950,  localPriceLevel: "low" },
  VAR: { airportCode: "VAR", transferCostCzk: 350, nightlyAccommodationEstimateCzk: 950,  localPriceLevel: "low" },
  // Cyprus / Malta
  LCA: { airportCode: "LCA", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1800, localPriceLevel: "high" },
  MLA: { airportCode: "MLA", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1800, localPriceLevel: "high" },
  // Canaries
  TFS: { airportCode: "TFS", transferCostCzk: 600, nightlyAccommodationEstimateCzk: 2000, localPriceLevel: "high" },
  LPA: { airportCode: "LPA", transferCostCzk: 600, nightlyAccommodationEstimateCzk: 2000, localPriceLevel: "high" },
  // Madeira
  FNC: { airportCode: "FNC", transferCostCzk: 500, nightlyAccommodationEstimateCzk: 1700, localPriceLevel: "high" },
  // Turkey
  AYT: { airportCode: "AYT", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1600, localPriceLevel: "medium" },
  // Egypt
  HRG: { airportCode: "HRG", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1400, localPriceLevel: "medium" },
  RMF: { airportCode: "RMF", transferCostCzk: 400, nightlyAccommodationEstimateCzk: 1400, localPriceLevel: "medium" },
};

const DEFAULT_DESTINATION_PROFILE: Omit<DestinationCostProfile, "airportCode"> = {
  transferCostCzk: 500,
  nightlyAccommodationEstimateCzk: 1400,
  localPriceLevel: "medium",
};

export function estimateTripTotalCost(option: ItineraryOption): TripCostEstimate {
  const notes: string[] = [];

  // 1. Origin access cost
  const originProfile = AIRPORT_COST_PROFILES[option.origin];
  const originAccessCostCzk = originProfile?.accessCostCzk;

  // 2. Destination transfer and nightly cost
  const rawDestProfile = DESTINATION_COST_PROFILES[option.destinationAirportCode];
  const destProfileFound = rawDestProfile !== undefined;
  const destProfile = rawDestProfile ?? {
    airportCode: option.destinationAirportCode,
    ...DEFAULT_DESTINATION_PROFILE,
  };
  const { transferCostCzk: destinationTransferCostCzk, nightlyAccommodationEstimateCzk } = destProfile;

  // 3. Nights
  const nights = option.nights > 0 ? option.nights : undefined;

  // 4. Flight price
  const flightPriceCzk = option.priceCzk;

  // 5. Accommodation estimate
  const accommodationEstimateCzk =
    nights !== undefined ? nightlyAccommodationEstimateCzk * nights : undefined;

  // 6. Total estimate — sum all known components
  let totalEstimateCzk = 0;

  if (flightPriceCzk !== undefined) {
    totalEstimateCzk += flightPriceCzk;
  } else {
    notes.push("Cena letenky není známa.");
  }

  if (originAccessCostCzk !== undefined) {
    totalEstimateCzk += originAccessCostCzk;
  }

  totalEstimateCzk += destinationTransferCostCzk;

  if (accommodationEstimateCzk !== undefined) {
    totalEstimateCzk += accommodationEstimateCzk;
  }

  notes.push("Ubytování je hrubý odhad.");

  if (originProfile && originProfile.accessCostCzk > 600) {
    notes.push(
      `Doprava na letiště ${option.origin}: ${originProfile.accessNote} (${originProfile.accessCostCzk} Kč).`
    );
  }

  notes.push(`Transfer v destinaci: ~${destinationTransferCostCzk} Kč.`);

  notes.push("Celková cena je orientační odhad.");

  // 7. Confidence
  const originProfileFound = originProfile !== undefined;
  const confidence: "low" | "medium" =
    flightPriceCzk !== undefined && originProfileFound && destProfileFound ? "medium" : "low";

  return {
    flightPriceCzk,
    originAccessCostCzk,
    destinationTransferCostCzk,
    accommodationEstimateCzk,
    totalEstimateCzk,
    nights,
    confidence,
    notes,
  };
}

export function getAirportAccessNote(originCode: string): string | undefined {
  return AIRPORT_COST_PROFILES[originCode]?.accessNote;
}
