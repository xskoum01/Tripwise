"use client";

import type { SavedSearch } from "@/lib/savedSearches/storage";

function formatRelativeDate(isoString?: string): string {
  if (!isoString) return "nikdy";
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "dnes";
    if (days === 1) return "včera";
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    if (months >= 1) return `${months}m zpět`;
    if (weeks >= 1) return `${weeks}t zpět`;
    return `${days}d zpět`;
  } catch {
    return "—";
  }
}

interface SavedSearchesProps {
  searches: SavedSearch[];
  onRun: (wish: string, savedId: string) => void;
  onDelete: (id: string) => void;
}

export function SavedSearches({ searches, onRun, onDelete }: SavedSearchesProps) {
  if (searches.length === 0) {
    return (
      <p className="text-sm italic text-ink/50">
        Ulož si opakované hledání, třeba: červenec · moře · 3–5 dní · do 7000 Kč.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {searches.map((s) => {
        const wishPreview = s.wish.length > 70 ? s.wish.slice(0, 70) + "…" : s.wish;

        return (
          <li key={s.id} className="flex gap-3 rounded-lg border border-ink/10 bg-white px-4 py-3 shadow-soft">
            {/* Left column */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{s.title ?? s.wish}</p>
              <p className="truncate text-xs text-ink/55" title={s.wish}>
                {wishPreview}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink/40">
                <span>Naposledy: {formatRelativeDate(s.lastRunAt)}</span>
                {s.lastBestPriceCzk !== undefined && (
                  <span className="font-semibold text-sea">
                    {s.lastBestPriceCzk.toLocaleString("cs-CZ")} Kč
                  </span>
                )}
                {s.lastBestDestination && <span>{s.lastBestDestination}</span>}
                {s.lastBestDateRange && <span>{s.lastBestDateRange}</span>}
              </div>
            </div>

            {/* Right column */}
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onRun(s.wish, s.id)}
                className="rounded-lg border border-sea/40 bg-sea/10 px-3 py-1 text-xs font-semibold text-sea transition hover:bg-sea/20"
              >
                Spustit
              </button>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="rounded-lg border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/50 transition hover:border-coral/40 hover:text-coral"
              >
                Smazat
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
