"use client";

import type { SavedSearch, SavedSearchRun } from "@/lib/savedSearches/storage";
import type { SourceConfidence } from "@/lib/search/types";

// ---------------------------------------------------------------------------
// Confidence label map
// ---------------------------------------------------------------------------

const CONFIDENCE_LABELS: Record<SourceConfidence, string> = {
  "official": "ověřené API",
  "official-test": "testovací API",
  "unofficial": "neoficiální zdroj",
  "cached": "cena z cache",
  "search-only": "pouze ověřovací odkaz",
  "demo": "demo data",
  "user-verified": "ověřeno uživatelem",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function priceTrend(
  history?: SavedSearchRun[]
): { text: string; direction: "down" | "up" | "flat" | "" } {
  if (!history) return { text: "", direction: "" };

  const withPrices = history.filter((r) => r.bestPriceCzk !== undefined);

  if (withPrices.length < 2) {
    if (withPrices.length === 1) return { text: "Nový výsledek", direction: "flat" };
    return { text: "", direction: "" };
  }

  // Take the two most recent entries that have prices.
  // History is stored newest-first (prepended), so index 0 is latest.
  const latest = withPrices[0];
  const previous = withPrices[1];

  const diff = latest.bestPriceCzk! - previous.bestPriceCzk!;

  if (diff < 0) {
    return {
      text: `Cena klesla o ${Math.abs(diff).toLocaleString("cs-CZ")} Kč`,
      direction: "down",
    };
  }
  if (diff > 0) {
    return {
      text: `Cena stoupla o ${diff.toLocaleString("cs-CZ")} Kč`,
      direction: "up",
    };
  }
  return { text: "Beze změny", direction: "flat" };
}

// Compact delta label derived directly from the two most-recent raw history
// entries (index 0 = newest, index 1 = previous), regardless of gaps in the
// filtered-price list used by priceTrend.
type DeltaLabel =
  | { kind: "down"; label: string }
  | { kind: "up"; label: string }
  | { kind: "flat" }
  | { kind: "new" }
  | { kind: "none" };

function computeDelta(history?: SavedSearchRun[]): DeltaLabel {
  if (!history || history.length === 0) return { kind: "none" };

  const first = history[0];
  if (first.bestPriceCzk === undefined) return { kind: "none" };

  // Exactly one entry with a price — show "nový výsledek"
  if (history.length < 2) return { kind: "new" };

  const second = history[1];
  if (second.bestPriceCzk === undefined) return { kind: "new" };

  const diff = first.bestPriceCzk - second.bestPriceCzk;

  if (diff < 0) {
    return {
      kind: "down",
      label: `↓ ${Math.abs(diff).toLocaleString("cs-CZ")} Kč`,
    };
  }
  if (diff > 0) {
    return {
      kind: "up",
      label: `↑ +${diff.toLocaleString("cs-CZ")} Kč`,
    };
  }
  return { kind: "flat" };
}

// ---------------------------------------------------------------------------
// Batch status badge
// ---------------------------------------------------------------------------

type BatchStatus = "waiting" | "running" | "done" | "failed" | string;

function BatchStatusBadge({ status }: { status: BatchStatus }) {
  if (status === "waiting") {
    return (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-600">
        čeká
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-400/20 text-amber-600 animate-pulse">
        běží…
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600/70">
        hotovo
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-coral/10 text-coral">
        chyba
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SavedSearchesProps {
  searches: SavedSearch[];
  onRun: (wish: string, savedId: string) => void;
  onDelete: (id: string) => void;
  batchStatuses?: Record<string, string>;
}

export function SavedSearches({ searches, onRun, onDelete, batchStatuses }: SavedSearchesProps) {
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
        const trend = priceTrend(s.priceHistory);
        const delta = computeDelta(s.priceHistory);
        const recentRuns = s.priceHistory ? s.priceHistory.slice(0, 5) : [];
        const confidenceLabel =
          s.lastBestSourceConfidence &&
          s.lastBestSourceConfidence in CONFIDENCE_LABELS
            ? CONFIDENCE_LABELS[s.lastBestSourceConfidence as SourceConfidence]
            : s.lastBestSourceConfidence ?? null;

        const batchStatus = batchStatuses?.[s.id];
        const isBusy = batchStatus === "running" || batchStatus === "waiting";

        return (
          <li
            key={s.id}
            className="rounded-lg border border-ink/10 bg-white px-4 py-3 shadow-soft"
          >
            {/* Top row */}
            <div className="flex gap-3">
              {/* Left column */}
              <div className="min-w-0 flex-1">
                {/* a) Title */}
                <p className="truncate text-sm font-bold text-ink">
                  {s.title ?? s.wish}
                  {batchStatus !== undefined && (
                    <BatchStatusBadge status={batchStatus} />
                  )}
                </p>

                {/* b) Wish preview */}
                <p className="truncate text-xs text-ink/55" title={s.wish}>
                  {wishPreview}
                </p>

                {/* c) Last run */}
                <p className="mt-0.5 text-[11px] text-ink/40">
                  Naposledy: {formatRelativeDate(s.lastRunAt)}
                </p>

                {/* d) Price line */}
                <div className="mt-0.5 text-xs">
                  {s.lastBestPriceCzk !== undefined ? (
                    <span>
                      <span className="font-semibold text-sea">
                        {s.lastBestPriceCzk.toLocaleString("cs-CZ")} Kč
                      </span>
                      {(s.lastBestDestination || s.lastBestAirline || confidenceLabel) && (
                        <span className="text-ink/55">
                          {s.lastBestDestination && ` · ${s.lastBestDestination}`}
                          {s.lastBestAirline && ` · ${s.lastBestAirline}`}
                          {confidenceLabel && ` · ${confidenceLabel}`}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="italic text-ink/40" title={s.priceHistory?.[0]?.noPricedReason}>bez cenového výsledku</span>
                  )}
                </div>

                {/* e) Weather line */}
                {s.lastBestTemperatureC !== undefined ? (
                  <p className="mt-0.5 text-xs text-ink/55">
                    Počasí:{" "}
                    <span className="font-medium text-ink/70">
                      {s.lastBestTemperatureC} °C
                    </span>
                    {s.lastBestWeatherLabel && ` · ${s.lastBestWeatherLabel}`}
                  </p>
                ) : s.lastRunAt ? (
                  <p className="mt-0.5 text-xs italic text-ink/35">
                    Počasí neznámé
                  </p>
                ) : null}

                {/* f) Trend line */}
                {trend.text && (
                  <p
                    className={`mt-0.5 text-[11px] ${
                      trend.direction === "down"
                        ? "text-sea"
                        : trend.direction === "up"
                          ? "text-coral"
                          : "text-ink/40"
                    }`}
                  >
                    {trend.text}
                  </p>
                )}

                {/* g) Compact delta label */}
                {delta.kind === "down" && (
                  <p className="mt-0.5 text-[11px] font-semibold text-sea">
                    {delta.label}
                  </p>
                )}
                {delta.kind === "up" && (
                  <p className="mt-0.5 text-[11px] font-semibold text-coral">
                    {delta.label}
                  </p>
                )}
                {delta.kind === "flat" && (
                  <p className="mt-0.5 text-[11px] text-ink/40">beze změny</p>
                )}
                {delta.kind === "new" && (
                  <p className="mt-0.5 text-[11px] text-ink/40">nový výsledek</p>
                )}
              </div>

              {/* Right column */}
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onRun(s.wish, s.id)}
                  disabled={isBusy}
                  className="rounded-lg border border-sea/40 bg-sea/10 px-3 py-1 text-xs font-semibold text-sea transition hover:bg-sea/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy ? "…" : "Spustit"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="rounded-lg border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/50 transition hover:border-coral/40 hover:text-coral"
                >
                  Smazat
                </button>
              </div>
            </div>

            {/* Price history accordion */}
            {s.priceHistory && s.priceHistory.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-ink/40 hover:text-ink/60">
                  Historie ({s.priceHistory.length})
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {recentRuns.map((run, idx) => (
                    <li key={idx} className="text-[10px] text-ink/50">
                      {run.runAt.slice(0, 10)}
                      {" | "}
                      {run.bestPriceCzk !== undefined
                        ? `${run.bestPriceCzk.toLocaleString("cs-CZ")} Kč`
                        : "—"}
                      {" | "}
                      {run.bestDestination ?? "—"}
                      {" | "}
                      {run.bestProvider ?? "—"}
                      {" | "}
                      {run.resultCount ?? 0}/{run.pricedResultCount ?? 0} s cenou
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
