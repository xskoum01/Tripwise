/**
 * Saved searches – localStorage persistence layer.
 *
 * TODO: price history – store per-run best prices so trends can be charted.
 * TODO: notifications – alert the user when the price drops below a threshold.
 * TODO: scheduled rerun – automatically re-execute the wish on a configurable interval.
 * TODO: cloud sync – replicate saved searches to a remote store for multi-device access.
 * TODO: compare runs – side-by-side view of results across multiple search runs.
 */

import { type SourceConfidence } from "@/lib/search/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single recorded run of a saved search.
 * Stored newest-first in SavedSearch.priceHistory (capped at 20 entries).
 */
export interface SavedSearchRun {
  id: string;
  runAt: string;                          // ISO 8601
  bestPriceCzk?: number;
  bestTotalTripEstimateCzk?: number;
  bestDestination?: string;
  bestDateRange?: string;
  bestProvider?: string;
  bestAirline?: string;
  bestSourceConfidence?: SourceConfidence;
  /** Temperature (°C) at the best-priced destination at the time of the run. */
  bestTemperatureC?: number;
  /** Human-readable weather confidence label, e.g. "prognóza", "odhad", "neověřeno". */
  bestWeatherConfidence?: string;
  resultCount: number;
  pricedResultCount: number;
  searchOnlyResultCount: number;
}

export interface SavedSearchRunComparison {
  previousPriceCzk?: number;
  currentPriceCzk?: number;
  deltaCzk?: number;
  direction: "down" | "up" | "same" | "new" | "no-priced-result";
  previousDestination?: string;
  currentDestination?: string;
  previousProvider?: string;
  currentProvider?: string;
}

export interface SavedSearch {
  id: string;
  title: string;
  wish: string;
  createdAt: string;                      // ISO 8601
  updatedAt: string;                      // ISO 8601
  lastRunAt?: string;                     // ISO 8601
  lastBestPriceCzk?: number;
  lastBestTotalTripEstimateCzk?: number;
  lastBestDestination?: string;
  lastBestDateRange?: string;
  notes?: string;
  // Extended last-run snapshot fields
  lastBestProvider?: string;
  lastBestAirline?: string;
  lastBestSourceConfidence?: SourceConfidence;
  lastBestAvailabilityStatus?: string;
  lastBestPriceStatus?: string;
  /** Temperature (°C) at the best-priced destination as of the last run. */
  lastBestTemperatureC?: number;
  /** Human-readable weather confidence label as of the last run, e.g. "prognóza", "odhad", "neověřeno". */
  lastBestWeatherLabel?: string;
  // Full run history (newest first, max 20 entries)
  priceHistory?: SavedSearchRun[];
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tripwise_saved_searches";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Type guard for SavedSearchRun – checks the three mandatory fields. */
export function isSavedSearchRun(item: unknown): item is SavedSearchRun {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["runAt"] === "string" &&
    typeof obj["resultCount"] === "number"
  );
}

/** Minimal type guard – every valid SavedSearch must have string id/wish/title. */
function isSavedSearch(item: unknown): item is SavedSearch {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  if (
    typeof obj["id"] !== "string" ||
    typeof obj["wish"] !== "string" ||
    typeof obj["title"] !== "string"
  ) {
    return false;
  }
  // Validate priceHistory array when present
  if ("priceHistory" in obj) {
    if (!Array.isArray(obj["priceHistory"])) return false;
    if (!(obj["priceHistory"] as unknown[]).every(isSavedSearchRun)) return false;
  }
  return true;
}

function persistAll(searches: SavedSearch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // Silently ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all saved searches from localStorage.
 * Returns an empty array on any error (parse failure, unavailable storage, …).
 */
export function listSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedSearch);
  } catch {
    return [];
  }
}

/**
 * Upserts a SavedSearch.
 * If an item with the same id already exists it is replaced in-place;
 * otherwise the new item is prepended (newest first).
 */
export function saveSearch(search: SavedSearch): void {
  const current = listSavedSearches();
  const existingIndex = current.findIndex((s) => s.id === search.id);
  if (existingIndex !== -1) {
    current[existingIndex] = search;
  } else {
    current.unshift(search);
  }
  persistAll(current);
}

/**
 * Removes the item with the given id.
 * No-op if the id is not found.
 */
export function deleteSavedSearch(id: string): void {
  const current = listSavedSearches();
  const filtered = current.filter((s) => s.id !== id);
  persistAll(filtered);
}

/**
 * Merges a partial patch into an existing SavedSearch and updates updatedAt.
 * No-op if the id is not found.
 */
export function updateSavedSearch(
  id: string,
  patch: Partial<Omit<SavedSearch, "id">>
): void {
  const current = listSavedSearches();
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) return;
  current[index] = {
    ...current[index],
    ...patch,
    id,                                      // id must never be overwritten
    updatedAt: new Date().toISOString(),
  };
  persistAll(current);
}

/**
 * Records a completed search run against a saved search.
 *
 * - Prepends the run to priceHistory (newest first), capping the array at 20 entries.
 * - Promotes the run's best-result fields to the top-level last* snapshot fields.
 * - Updates updatedAt to the run timestamp.
 * - No-op if no saved search with the given id exists.
 */
export function recordRun(id: string, run: SavedSearchRun): void {
  const current = listSavedSearches();
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) return;

  const existing = current[index];
  const history = existing.priceHistory ?? [];

  current[index] = {
    ...existing,
    id,
    updatedAt: run.runAt,
    lastRunAt: run.runAt,
    lastBestPriceCzk: run.bestPriceCzk,
    ...(run.bestTotalTripEstimateCzk !== undefined
      ? { lastBestTotalTripEstimateCzk: run.bestTotalTripEstimateCzk }
      : {}),
    lastBestDestination: run.bestDestination,
    lastBestDateRange: run.bestDateRange,
    lastBestProvider: run.bestProvider,
    lastBestAirline: run.bestAirline,
    lastBestSourceConfidence: run.bestSourceConfidence,
    // Promote temperature/weather fields when the run carries them
    ...(run.bestTemperatureC !== undefined
      ? { lastBestTemperatureC: run.bestTemperatureC }
      : {}),
    ...(run.bestWeatherConfidence !== undefined
      ? { lastBestWeatherLabel: run.bestWeatherConfidence }
      : {}),
    priceHistory: [run, ...history].slice(0, 20),
  };

  persistAll(current);
}

/**
 * Compares a current search run against previous runs to produce a price
 * movement summary.
 *
 * - If current has no bestPriceCzk: direction "no-priced-result".
 * - If no previous run has a bestPriceCzk: direction "new".
 * - Otherwise: direction "down" / "up" / "same" based on deltaCzk.
 */
export function computeRunComparison(
  current: SavedSearchRun,
  previousRuns: SavedSearchRun[]
): SavedSearchRunComparison {
  const previousPriced = previousRuns.find(
    (r) => r.bestPriceCzk !== undefined
  );

  if (current.bestPriceCzk === undefined) {
    return {
      direction: "no-priced-result",
      currentDestination: current.bestDestination,
      currentProvider: current.bestProvider,
    };
  }

  if (previousPriced === undefined) {
    return {
      direction: "new",
      currentPriceCzk: current.bestPriceCzk,
      currentDestination: current.bestDestination,
      currentProvider: current.bestProvider,
    };
  }

  const deltaCzk = current.bestPriceCzk - previousPriced.bestPriceCzk!;
  const direction =
    deltaCzk < 0 ? "down" : deltaCzk > 0 ? "up" : "same";

  return {
    previousPriceCzk: previousPriced.bestPriceCzk,
    currentPriceCzk: current.bestPriceCzk,
    deltaCzk,
    direction,
    previousDestination: previousPriced.bestDestination,
    currentDestination: current.bestDestination,
    previousProvider: previousPriced.bestProvider,
    currentProvider: current.bestProvider,
  };
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

/** Maps normalised (lowercase, no-diacritics) keyword → display label. */
const MONTH_KEYWORDS: Array<[RegExp, string]> = [
  [/\bcervenec\b|\bcervence\b/, "Červenec"],
  [/\bcerven\b|\bcervnu\b/, "Červen"],
  [/\bsrpen\b|\bsrpna\b/, "Srpen"],
  [/\bzari\b|\bzaria\b/, "Září"],
  [/\brijen\b|\brijna\b/, "Říjen"],
  [/\blisTopad\b|\blistopadu\b/i, "Listopad"],
  [/\bprosinec\b|\bprosinci\b/, "Prosinec"],
  [/\leden\b|\bledna\b/, "Leden"],
  [/\bunor\b|\bunora\b/, "Únor"],
  [/\bbrezen\b|\bbrezna\b/, "Březen"],
  [/\bduben\b|\bdubna\b/, "Duben"],
  [/\bkveten\b|\bkvetna\b/, "Květen"],
];

const DESTINATION_KEYWORDS: Array<[RegExp, string]> = [
  [/\bk\s+mori\b|\bmore\b|\bu\s+more\b/, "moře"],
  [/\bza\s+teplem\b/, "za teplem"],
  [/\bcity\s*break\b|\bmesto\b|\bměsto\b/, "city break"],
  [/\bhory\b|\bdo\s+hor\b/, "hory"],
  [/\blyze\b|\blyžov/, "lyžování"],
];

/** Remove diacritics from a string (NFD decomposition + strip combining marks). */
function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Generates a human-readable title from a free-text wish.
 *
 * Strategy:
 *  1. Normalise: lowercase + strip diacritics for matching only.
 *  2. Detect month keywords.
 *  3. Detect destination-mode keywords.
 *  4. Detect budget pattern "do/max <number>".
 *  5. Join detected parts with " · ".
 *  6. Fall back to the first 60 characters of the raw wish when nothing matched.
 */
export function generateTitle(wish: string): string {
  const normalised = removeDiacritics(wish.toLowerCase());

  const parts: string[] = [];

  // --- month detection ---
  for (const [pattern, label] of MONTH_KEYWORDS) {
    if (pattern.test(normalised)) {
      parts.push(label);
      break; // only the first match to avoid duplicates
    }
  }

  // --- destination / trip-type detection ---
  for (const [pattern, label] of DESTINATION_KEYWORDS) {
    if (pattern.test(normalised)) {
      parts.push(label);
      break;
    }
  }

  // --- budget detection: "do 5000", "max 5 000", "do 5.000", … ---
  const budgetMatch = normalised.match(/(?:do|max)\s*([0-9][0-9\s.]*)/);
  if (budgetMatch) {
    // Strip spaces and dots so we get a plain integer string
    const digits = budgetMatch[1].replace(/[\s.]/g, "").replace(/\D/g, "");
    if (digits.length > 0) {
      parts.push(`do ${digits} Kč`);
    }
  }

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  // Fall back: first 60 chars of the trimmed wish
  return wish.trim().slice(0, 60);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new SavedSearch from a wish string.
 *
 * ID is derived from the current timestamp plus a random suffix so it is
 * unique without requiring the Web Crypto API (maximises compatibility with
 * SSR / non-secure contexts).
 */
export function createSavedSearchFromWish(
  wish: string,
  title?: string
): SavedSearch {
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const trimmedWish = wish.trim();

  return {
    id,
    title: title ?? generateTitle(trimmedWish),
    wish: trimmedWish,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// TODO: future enhancements
// ---------------------------------------------------------------------------

// TODO: price alerts – let users set a target price per saved search and send a
//       browser notification (or email via an API route) when bestPriceCzk drops
//       below the threshold. Requires persisting the threshold in SavedSearch and
//       a background polling mechanism (e.g. Service Worker or server-side cron).

// TODO: trend chart – expose priceHistory to the UI so a sparkline / line chart
//       can visualise how the cheapest available fare has changed over time for
//       a given saved search.

// TODO: cross-device sync – replicate the localStorage data to a remote store
//       (e.g. Supabase, Firestore, or a custom API route) so saved searches and
//       price history are available on all of the user's devices. Requires an
//       auth layer and a conflict-resolution strategy (last-write-wins is fine
//       for most fields; priceHistory arrays should be merged by run id).
