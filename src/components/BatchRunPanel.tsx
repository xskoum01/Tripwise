"use client";

import { useState, useCallback } from "react";
import type { SavedSearch } from "@/lib/savedSearches/storage";
import type { BatchItemResult, BatchItemStatus } from "@/lib/savedSearches/batchRunner";
import { runSingleBatchSearch } from "@/lib/savedSearches/batchRunner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BatchRunPanelProps {
  searches: SavedSearch[];
  onComplete: () => void;
  onStatusChange: (statuses: Record<string, BatchItemStatus>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: BatchItemStatus): string {
  switch (status) {
    case "waiting": return "⏳";
    case "running": return "⏱";
    case "done":    return "✓";
    case "failed":  return "✗";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchRunPanel({ searches, onComplete, onStatusChange }: BatchRunPanelProps) {
  const [items, setItems] = useState<BatchItemResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleBatchRun = useCallback(async () => {
    if (isRunning || searches.length === 0) return;

    setIsRunning(true);
    setIsDone(false);

    // Initialise item list – all waiting
    const initialItems: BatchItemResult[] = searches.map((s) => ({
      savedId: s.id,
      title: s.title,
      wish: s.wish,
      status: "waiting" as BatchItemStatus,
    }));
    setItems(initialItems);

    // Mutable working copy so we can accumulate results inside the loop
    const working = [...initialItems];

    // Helper: push updated working copy to state and call onStatusChange
    function flush() {
      const snapshot = [...working];
      setItems(snapshot);
      const statuses: Record<string, BatchItemStatus> = {};
      for (const item of snapshot) {
        statuses[item.savedId] = item.status;
      }
      onStatusChange(statuses);
    }

    // Process in chunks of 2
    const CHUNK = 2;
    for (let i = 0; i < working.length; i += CHUNK) {
      const chunk = working.slice(i, i + CHUNK);

      // Mark the chunk as running
      for (const item of chunk) {
        item.status = "running";
      }
      flush();

      // Run concurrently — look up original SavedSearch by savedId
      const results = await Promise.allSettled(
        chunk.map((item) => {
          const search = searches.find((s) => s.id === item.savedId);
          if (!search) return Promise.reject(new Error("Saved search not found"));
          return runSingleBatchSearch(search);
        })
      );

      // Merge results back into working array
      results.forEach((result, idx) => {
        const workingIndex = i + idx;
        if (result.status === "fulfilled") {
          working[workingIndex] = result.value;
        } else {
          working[workingIndex] = {
            ...working[workingIndex],
            status: "failed",
            errorMessage: result.reason instanceof Error ? result.reason.message : String(result.reason),
          };
        }
      });
      flush();
    }

    setIsRunning(false);
    setIsDone(true);
    onComplete();
  }, [isRunning, searches, onComplete, onStatusChange]);

  // -------------------------------------------------------------------------
  // Derived counts for summary header
  // -------------------------------------------------------------------------

  const total = searches.length;
  const completedCount = items.filter((i) => i.status === "done" || i.status === "failed").length;
  const pricedCount = items.filter((i) => i.status === "done" && i.run?.bestPriceCzk !== undefined).length;
  const downCount = items.filter((i) => i.comparison?.direction === "down").length;
  const upCount = items.filter((i) => i.comparison?.direction === "up").length;
  const noResultCount = items.filter((i) => i.status === "done" && i.run?.bestPriceCzk === undefined).length;

  // -------------------------------------------------------------------------
  // Initial state – just the trigger button
  // -------------------------------------------------------------------------

  if (items.length === 0 && !isRunning) {
    return (
      <button
        type="button"
        onClick={handleBatchRun}
        disabled={searches.length === 0}
        className="w-full rounded-lg border border-ink/20 bg-white/80 px-4 py-2 text-sm font-semibold text-ink/70 transition hover:border-sea/40 hover:bg-sea/5 hover:text-sea disabled:cursor-not-allowed disabled:opacity-40"
      >
        Spustit všechna uložená hledání
      </button>
    );
  }

  // -------------------------------------------------------------------------
  // Running / done – full panel
  // -------------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-ink/10 bg-white/80 shadow-soft">
      {/* Header */}
      <div className="border-b border-ink/10 px-5 py-3">
        {isRunning && (
          <p className="text-sm font-semibold text-ink/70">
            Spouštím{" "}
            <span className="font-black text-ink">{completedCount}</span>
            {" / "}
            <span className="font-black text-ink">{total}</span>{" "}
            uložených hledání…
          </p>
        )}
        {isDone && (
          <p className="text-sm font-semibold text-ink/70">
            Hotovo:{" "}
            <span className="font-black text-ink">{total} hledání</span>
            {" · "}
            <span className="font-bold text-ink">{pricedCount} s cenovým výsledkem</span>
            {" · "}
            <span className="font-bold text-sea">{downCount} zlevnilo</span>
            {" · "}
            <span className="font-bold text-coral">{upCount} zdražilo</span>
            {" · "}
            <span className="font-bold text-ink/55">{noResultCount} bez výsledku</span>
          </p>
        )}
      </div>

      {/* Per-item rows */}
      <ul className="divide-y divide-ink/5">
        {items.map((item) => {
          const direction = item.comparison?.direction;
          const deltaCzk = item.comparison?.deltaCzk;

          return (
            <li key={item.savedId} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
              {/* Status icon */}
              <span
                className={`shrink-0 text-base ${
                  item.status === "done"
                    ? "text-sea"
                    : item.status === "failed"
                      ? "text-coral"
                      : "text-ink/40"
                }`}
                aria-label={item.status}
              >
                {statusIcon(item.status)}
              </span>

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={item.title}>
                {item.title}
              </span>

              {/* Result detail */}
              <span className="text-xs font-semibold text-ink/60 sm:text-right">
                {item.status === "done" && item.run?.bestPriceCzk !== undefined && (
                  <>
                    {item.run.bestPriceCzk.toLocaleString("cs-CZ")} Kč
                    {item.run.bestDestination && ` · ${item.run.bestDestination}`}
                    {item.run.bestAirline && ` · ${item.run.bestAirline}`}
                  </>
                )}
                {item.status === "done" && item.run?.bestPriceCzk === undefined && (
                  <span className="text-ink/40" title={item.run?.noPricedReason}>bez cenového výsledku</span>
                )}
                {item.status === "failed" && item.errorMessage && (
                  <span className="text-coral">{item.errorMessage}</span>
                )}
              </span>

              {/* Trend label */}
              {direction && direction !== "no-priced-result" && (
                <span
                  className={`shrink-0 text-xs font-bold ${
                    direction === "down"
                      ? "text-sea"
                      : direction === "up"
                        ? "text-coral"
                        : direction === "same"
                          ? "text-ink/40"
                          : "text-ink/55"
                  }`}
                >
                  {direction === "down" && deltaCzk !== undefined
                    ? `↓ −${Math.abs(deltaCzk).toLocaleString("cs-CZ")} Kč`
                    : direction === "up" && deltaCzk !== undefined
                      ? `↑ +${deltaCzk.toLocaleString("cs-CZ")} Kč`
                      : direction === "same"
                        ? "beze změny"
                        : direction === "new"
                          ? "nový výsledek"
                          : null}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer actions */}
      {isDone && (
        <div className="flex gap-2 border-t border-ink/10 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setItems([]);
              setIsDone(false);
            }}
            className="rounded-lg border border-ink/15 px-4 py-1.5 text-sm font-semibold text-ink/60 transition hover:border-ink/30 hover:text-ink"
          >
            Zavřít
          </button>
          <button
            type="button"
            onClick={() => {
              setItems([]);
              setIsDone(false);
              // Brief defer so state clears before re-running
              setTimeout(handleBatchRun, 0);
            }}
            className="rounded-lg border border-sea/30 bg-sea/5 px-4 py-1.5 text-sm font-semibold text-sea transition hover:bg-sea/10"
          >
            Spustit znovu
          </button>
        </div>
      )}
    </div>
  );
}
