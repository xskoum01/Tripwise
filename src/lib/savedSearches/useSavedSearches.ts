"use client";

import { useState, useCallback } from "react";
import {
  listSavedSearches,
  saveSearch,
  deleteSavedSearch,
  updateSavedSearch,
  createSavedSearchFromWish,
  type SavedSearch,
} from "./storage";

export type { SavedSearch };

// SSR-safe loader: returns [] when running on the server where localStorage
// is unavailable. Used as a lazy initializer so no useEffect is needed.
function loadFromStorage(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  return listSavedSearches();
}

export function useSavedSearches() {
  // Lazy initializer runs once on mount (client-only).
  // Avoids the pattern of calling setState inside a useEffect.
  const [searches, setSearches] = useState<SavedSearch[]>(loadFromStorage);

  const reload = useCallback(() => {
    setSearches(loadFromStorage());
  }, []);

  const save = useCallback(
    (wish: string, title?: string): SavedSearch => {
      const created = createSavedSearchFromWish(wish, title);
      saveSearch(created);
      reload();
      return created;
    },
    [reload],
  );

  const remove = useCallback(
    (id: string): void => {
      deleteSavedSearch(id);
      reload();
    },
    [reload],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<SavedSearch, "id">>): void => {
      updateSavedSearch(id, patch);
      reload();
    },
    [reload],
  );

  return { searches, save, remove, update, refresh: reload };
}
