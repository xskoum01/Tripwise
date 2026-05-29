// Route candidate registry.
// Describes which airlines are worth checking for which origin airports
// and destination types. Used by SearchOnlyAirlineAdapter to generate
// manual-verification candidates when no priced data is available.
//
// Confidence levels:
//   known       — airline confirmed to operate this route (schedule/public info)
//   likely      — high probability based on network/hub analysis
//   exploratory — worth checking but unconfirmed

import type { DestinationMode } from "./types";

export type RouteCandidate = {
  airlineId: string;
  origin: string;
  destinationModes: DestinationMode[];
  destinationCodes?: string[];
  confidence: "known" | "likely" | "exploratory";
  seasonality: "year-round" | "summer" | "winter" | "unknown";
};

// Practical destination pool for candidate generation
export const CANDIDATE_DESTINATIONS: Array<{
  code: string;
  city: string;
  country: string;
  modes: DestinationMode[];
}> = [
  { code: "AGP", city: "Málaga", country: "Španělsko", modes: ["sea", "warm"] },
  { code: "ALC", city: "Alicante", country: "Španělsko", modes: ["sea", "warm"] },
  { code: "BCN", city: "Barcelona", country: "Španělsko", modes: ["sea", "warm", "cityBreak"] },
  { code: "PMI", city: "Mallorca", country: "Španělsko", modes: ["sea", "warm"] },
  { code: "NCE", city: "Nice", country: "Francie", modes: ["sea", "cityBreak"] },
  { code: "SPU", city: "Split", country: "Chorvatsko", modes: ["sea"] },
  { code: "DBV", city: "Dubrovník", country: "Chorvatsko", modes: ["sea"] },
  { code: "ZAD", city: "Zadar", country: "Chorvatsko", modes: ["sea"] },
  { code: "FCO", city: "Řím", country: "Itálie", modes: ["cityBreak"] },
  { code: "CIA", city: "Řím Ciampino", country: "Itálie", modes: ["cityBreak"] },
  { code: "BGY", city: "Milán Bergamo", country: "Itálie", modes: ["cityBreak"] },
  { code: "MXP", city: "Milán Malpensa", country: "Itálie", modes: ["cityBreak"] },
  { code: "ATH", city: "Atény", country: "Řecko", modes: ["sea", "warm", "cityBreak"] },
  { code: "SKG", city: "Soluň", country: "Řecko", modes: ["sea", "warm"] },
  { code: "LCA", city: "Larnaka", country: "Kypr", modes: ["sea", "warm"] },
  { code: "MLA", city: "Malta", country: "Malta", modes: ["sea", "warm"] },
  { code: "TFS", city: "Tenerife", country: "Kanárské ostrovy", modes: ["sea", "warm"] },
  { code: "LPA", city: "Gran Canaria", country: "Kanárské ostrovy", modes: ["sea", "warm"] },
  { code: "FAO", city: "Faro", country: "Portugalsko", modes: ["sea", "warm"] },
  { code: "LIS", city: "Lisabon", country: "Portugalsko", modes: ["sea", "cityBreak"] },
  { code: "OPO", city: "Porto", country: "Portugalsko", modes: ["cityBreak"] },
  { code: "VLC", city: "Valencia", country: "Španělsko", modes: ["sea", "cityBreak"] },
  { code: "SVQ", city: "Sevilla", country: "Španělsko", modes: ["cityBreak"] },
  { code: "NAP", city: "Neapol", country: "Itálie", modes: ["sea", "cityBreak"] },
  { code: "CTA", city: "Catania", country: "Itálie", modes: ["sea"] },
  { code: "PMO", city: "Palermo", country: "Itálie", modes: ["sea"] },
  { code: "TIA", city: "Tirana", country: "Albánie", modes: ["sea", "cityBreak"] },
  { code: "SKP", city: "Skopje", country: "Severní Makedonie", modes: ["cityBreak"] },
  { code: "SOF", city: "Sofie", country: "Bulharsko", modes: ["cityBreak"] },
  { code: "OTP", city: "Bukurešť", country: "Rumunsko", modes: ["cityBreak"] },
  { code: "VAR", city: "Varna", country: "Bulharsko", modes: ["sea", "warm"] },
  { code: "BOJ", city: "Burgas", country: "Bulharsko", modes: ["sea", "warm"] },
  { code: "HRG", city: "Hurghada", country: "Egypt", modes: ["sea", "warm"] },
  { code: "RMF", city: "Marsa Alam", country: "Egypt", modes: ["sea", "warm"] },
  { code: "AYT", city: "Antalya", country: "Turecko", modes: ["sea", "warm"] },
];

export const CANDIDATE_DESTINATION_MAP = new Map(CANDIDATE_DESTINATIONS.map((d) => [d.code, d]));

// Route candidates: which airlines cover which origins and destination types.
// A single airline can have multiple entries for different origins.
export const ROUTE_CANDIDATES: RouteCandidate[] = [
  // ── Ryanair ──────────────────────────────────────────────────────────────────
  { airlineId: "ryanair", origin: "PRG", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "ryanair", origin: "VIE", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "ryanair", origin: "BTS", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "ryanair", origin: "BRQ", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "summer" },
  { airlineId: "ryanair", origin: "OSR", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Wizz Air ─────────────────────────────────────────────────────────────────
  { airlineId: "wizz", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "wizz", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "wizz", origin: "BTS", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "wizz", origin: "BRQ", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Eurowings ─────────────────────────────────────────────────────────────────
  { airlineId: "eurowings", origin: "VIE", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "eurowings", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Vueling ───────────────────────────────────────────────────────────────────
  { airlineId: "vueling", origin: "PRG", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "likely", seasonality: "summer" },
  { airlineId: "vueling", origin: "VIE", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "likely", seasonality: "summer" },

  // ── easyJet ───────────────────────────────────────────────────────────────────
  { airlineId: "easyjet", origin: "PRG", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },
  { airlineId: "easyjet", origin: "VIE", destinationModes: ["sea", "warm", "cityBreak", "any"], confidence: "known", seasonality: "year-round" },

  // ── Smartwings ────────────────────────────────────────────────────────────────
  { airlineId: "smartwings", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "summer", destinationCodes: ["AGP", "ALC", "PMI", "AYT", "HRG", "RMF", "TFS", "LPA", "SPU", "DBV", "ZAD"] },
  { airlineId: "smartwings", origin: "BRQ", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "summer", destinationCodes: ["AGP", "AYT", "HRG", "PMI"] },
  { airlineId: "smartwings", origin: "OSR", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["AGP", "AYT", "HRG"] },
  { airlineId: "smartwings", origin: "PED", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["AYT", "HRG"] },

  // ── Pegasus ───────────────────────────────────────────────────────────────────
  { airlineId: "pegasus", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "year-round", destinationCodes: ["AYT", "SAW", "IST", "ESB"] },
  { airlineId: "pegasus", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "year-round", destinationCodes: ["AYT", "SAW", "IST"] },

  // ── SunExpress ────────────────────────────────────────────────────────────────
  { airlineId: "sunexpress", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "summer", destinationCodes: ["AYT", "DLM", "BOD"] },
  { airlineId: "sunexpress", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "summer", destinationCodes: ["AYT", "DLM"] },

  // ── Transavia ─────────────────────────────────────────────────────────────────
  { airlineId: "transavia", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Norwegian ─────────────────────────────────────────────────────────────────
  { airlineId: "norwegian", origin: "PRG", destinationModes: ["cityBreak", "any"], confidence: "likely", seasonality: "year-round" },
  { airlineId: "norwegian", origin: "VIE", destinationModes: ["cityBreak", "any"], confidence: "likely", seasonality: "year-round" },

  // ── Volotea ───────────────────────────────────────────────────────────────────
  { airlineId: "volotea", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── airBaltic ─────────────────────────────────────────────────────────────────
  { airlineId: "airbaltic", origin: "PRG", destinationModes: ["cityBreak", "any"], confidence: "likely", seasonality: "year-round" },
  { airlineId: "airbaltic", origin: "VIE", destinationModes: ["cityBreak", "any"], confidence: "likely", seasonality: "year-round" },

  // ── AJet ─────────────────────────────────────────────────────────────────────
  { airlineId: "ajet", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "known", seasonality: "year-round", destinationCodes: ["AYT", "ESB"] },
  { airlineId: "ajet", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Corendon ──────────────────────────────────────────────────────────────────
  { airlineId: "corendon", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["AYT", "HRG", "TFS"] },
  { airlineId: "corendon", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer" },

  // ── Air Cairo ─────────────────────────────────────────────────────────────────
  { airlineId: "aircairo", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["HRG", "RMF"] },
  { airlineId: "aircairo", origin: "VIE", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["HRG", "RMF"] },
  { airlineId: "aircairo", origin: "PED", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["HRG", "RMF"] },

  // ── Condor ────────────────────────────────────────────────────────────────────
  { airlineId: "condor", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "likely", seasonality: "summer", destinationCodes: ["TFS", "LPA", "AYT"] },

  // ── Jet2 ─────────────────────────────────────────────────────────────────────
  { airlineId: "jet2", origin: "PRG", destinationModes: ["sea", "warm", "any"], confidence: "exploratory", seasonality: "summer" },
];
