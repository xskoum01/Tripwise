/**
 * Saved searches – localStorage persistence layer.
 *
 * TODO: price history – store per-run best prices so trends can be charted.
 * TODO: notifications – alert the user when the price drops below a threshold.
 * TODO: scheduled rerun – automatically re-execute the wish on a configurable interval.
 * TODO: cloud sync – replicate saved searches to a remote store for multi-device access.
 * TODO: compare runs – side-by-side view of results across multiple search runs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedSearch {
  id: string;
  title: string;
  wish: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  lastRunAt?: string;      // ISO 8601
  lastBestPriceCzk?: number;
  lastBestDestination?: string;
  lastBestDateRange?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tripwise_saved_searches";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Minimal type guard – every valid SavedSearch must have string id/wish/title. */
function isSavedSearch(item: unknown): item is SavedSearch {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["wish"] === "string" &&
    typeof obj["title"] === "string"
  );
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
