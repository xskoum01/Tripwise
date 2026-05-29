"use client";

import { useState, useEffect, useRef } from "react";
import { FilterSummary } from "./FilterSummary";
import { TripResults } from "./TripResults";
import type { OriginAirport, SearchResponse, TravelSearchRequest } from "@/lib/search/types";
import { useSavedSearches } from "@/lib/savedSearches/useSavedSearches";
import { recordRun, computeRunComparison, listSavedSearches } from "@/lib/savedSearches/storage";
import type { SavedSearchRunComparison } from "@/lib/savedSearches/storage";
import { buildSavedSearchRun, type BatchItemStatus } from "@/lib/savedSearches/batchRunner";
import { SavedSearches } from "./SavedSearches";
import { BatchRunPanel } from "./BatchRunPanel";

type SearchErrorResponse = {
  error?: string;
  details?: string;
};

const originOptions: Array<{ code: OriginAirport; label: string }> = [
  { code: "PRG", label: "Praha" },
  { code: "VIE", label: "Vídeň" },
  { code: "BRQ", label: "Brno" },
  { code: "PED", label: "Pardubice" },
];

export function SearchPanel() {
  const [wish, setWish] = useState("Chci v červnu na 3-5 dní k moři do 7 000 Kč, odlet Praha nebo Vídeň, nechci odlet před 6 ráno.");
  const [origins, setOrigins] = useState<OriginAirport[]>(["PRG", "VIE"]);
  const [maxBudget, setMaxBudget] = useState(7000);
  const [directOnly, setDirectOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [runComparison, setRunComparison] = useState<SavedSearchRunComparison | null>(null);

  const { searches, save, remove, refresh } = useSavedSearches();
  const [batchStatuses, setBatchStatuses] = useState<Record<string, BatchItemStatus>>({});
  // useRef instead of useState: mutating a ref inside an effect is allowed and
  // avoids the react-hooks/set-state-in-effect lint rule. No re-render needed
  // when tracking which saved search triggered the current search.
  const activeSavedIdRef = useRef<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasResults = Boolean(results);
  const showSearchForm = !hasResults || editing;

  function handleSave() {
    save(wish);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }

  function handleRunSaved(savedWish: string, savedId: string) {
    activeSavedIdRef.current = savedId;
    setWish(savedWish);
    void handleSearch(savedWish);
  }

  useEffect(() => {
    const savedId = activeSavedIdRef.current;
    if (!results || !savedId) return;

    const runAt = new Date().toISOString();
    const run = buildSavedSearchRun(savedId, results, runAt);
    const existingHistory = listSavedSearches().find((s) => s.id === savedId)?.priceHistory ?? [];
    const comparison = computeRunComparison(run, existingHistory);
    recordRun(savedId, run);
    refresh();
    setRunComparison(comparison);
    activeSavedIdRef.current = null;
  }, [results, refresh]);

  function syncControls(request: TravelSearchRequest) {
    setOrigins(request.origins);
    setMaxBudget(request.maxBudget ?? 7000);
    setDirectOnly(request.directOnly);
  }

  function toggleOrigin(code: OriginAirport) {
    setOrigins((current) => (current.includes(code) ? current.filter((origin) => origin !== code) : [...current, code]));
  }

  async function handleSearch(wishOverride?: string) {
    setRunComparison(null);
    setLoading(true);
    setError(null);

    const payload: Partial<TravelSearchRequest> & { wish: string } = {
      wish: wishOverride ?? wish,
      origins: origins.length > 0 ? origins : ["PRG", "VIE"],
      maxBudget,
      directOnly,
      baggage: "backpack",
      avoidEarlyFlights: false,
      weekendOnly: false,
      destinationMode: "any",
      intent: "value",
    };

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message: string;

        if (response.status === 404) {
          message = "API route /api/search not found. Restart the dev server (npm run dev) and try again.";
        } else {
          try {
            const errorBody = (await response.json()) as SearchErrorResponse;
            message = errorBody.details ?? errorBody.error ?? `Server error ${response.status}`;
          } catch {
            message = `Server error ${response.status}: ${response.statusText || "unknown"}`;
          }
        }

        throw new Error(message);
      }
      const nextResults = (await response.json()) as SearchResponse;
      setResults(nextResults);
      syncControls(nextResults.parsedRequest);
      setEditing(false);
    } catch (error) {
      const details = error instanceof Error ? error.message : undefined;
      const isDevelopment = process.env.NODE_ENV !== "production";
      setError(
        isDevelopment && details
          ? `Vyhledávání se nepovedlo: ${details}`
          : "Vyhledávání se nepovedlo. Zkuste to prosím znovu.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={hasResults ? "space-y-4" : "space-y-6"}>
      <Hero compact={hasResults} />

      {results && (
        <section className="rounded-lg border border-ink/10 bg-white/95 p-3 shadow-soft md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-sea">Aktuální hledání</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-ink">{results.parsedRequest.wish}</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <FilterSummary request={results.appliedFilters} compact />
              <button
                type="button"
                onClick={() => setEditing((current) => !current)}
                className="min-h-10 rounded-lg border border-sea/30 bg-mint px-4 text-sm font-black text-sea transition hover:border-sea hover:bg-white"
              >
                Upravit hledání
              </button>
            </div>
          </div>
        </section>
      )}

      {showSearchForm && (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <label htmlFor="wish" className="text-sm font-black text-ink">
                Kam chcete letět?
              </label>
              <textarea
                id="wish"
                value={wish}
                onChange={(event) => setWish(event.target.value)}
                rows={hasResults ? 3 : 5}
                className="mt-2 w-full resize-none rounded-lg border border-ink/15 bg-slate-50 p-4 text-base font-semibold text-ink outline-none transition focus:border-sea focus:bg-white"
              />
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-black text-ink">Ruční filtry</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {originOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => toggleOrigin(option.code)}
                      className={`min-h-10 rounded-lg border px-3 text-sm font-bold transition ${
                        origins.includes(option.code) ? "border-sea bg-sea text-white" : "border-ink/10 bg-white text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-black text-ink">
                Rozpočet
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={maxBudget}
                  onChange={(event) => setMaxBudget(Number(event.target.value))}
                  className="mt-2 h-11 w-full rounded-lg border border-ink/15 bg-slate-50 px-3 font-bold text-ink"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-slate-50 px-3 py-3 text-sm font-bold text-ink">
                <input type="checkbox" checked={directOnly} onChange={(event) => setDirectOnly(event.target.checked)} className="h-4 w-4 accent-sea" />
                Pouze přímý let
              </label>

              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={loading}
                className="min-h-11 w-full rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-sea disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Hledám..." : hasResults ? "Aktualizovat výsledky" : "Vyhledat"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="min-h-10 w-full rounded-lg border border-ink/15 bg-slate-50 px-4 text-sm font-bold text-ink/65 transition hover:border-sea/40 hover:bg-mint hover:text-sea"
              >
                {saveSuccess ? "Uloženo ✓" : "Uložit hledání"}
              </button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm font-bold text-coral">{error}</p>}
        </section>
      )}

      {loading && (
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <div className="h-4 w-48 animate-pulse rounded bg-ink/10" />
          <div className="mt-4 h-24 animate-pulse rounded bg-ink/5" />
        </div>
      )}

      {runComparison && <RunComparisonBanner comparison={runComparison} />}
      {results && !loading && <TripResults data={results} />}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/55">Uložená hledání</h2>
        <BatchRunPanel
          searches={searches}
          onComplete={refresh}
          onStatusChange={setBatchStatuses}
        />
        <SavedSearches searches={searches} onRun={handleRunSaved} onDelete={remove} batchStatuses={batchStatuses} />
      </section>
    </div>
  );
}

function RunComparisonBanner({ comparison }: { comparison: import("@/lib/savedSearches/storage").SavedSearchRunComparison }) {
  let text: string;
  let colorClass: string;

  switch (comparison.direction) {
    case "down":
      text = `Cena klesla o ${Math.abs(comparison.deltaCzk ?? 0).toLocaleString("cs-CZ")} Kč oproti minulému běhu.`;
      colorClass = "bg-sea/10 text-sea";
      break;
    case "up":
      text = `Cena stoupla o ${(comparison.deltaCzk ?? 0).toLocaleString("cs-CZ")} Kč oproti minulému běhu.`;
      colorClass = "bg-coral/10 text-coral";
      break;
    case "same":
      text = "Cena je stejná jako minule.";
      colorClass = "bg-ink/5 text-ink/65";
      break;
    case "new": {
      const parts: string[] = ["Nový cenový výsledek:"];
      if (comparison.currentDestination) parts.push(comparison.currentDestination);
      if (comparison.currentPriceCzk !== undefined) {
        parts.push(`za ${comparison.currentPriceCzk.toLocaleString("cs-CZ")} Kč.`);
      } else {
        parts[parts.length - 1] += ".";
      }
      text = parts.join(" ");
      colorClass = "bg-ink/5 text-ink/65";
      break;
    }
    case "no-priced-result":
      text = "Tentokrát jsme nenašli žádný cenový výsledek.";
      colorClass = "bg-ink/5 text-ink/65";
      break;
    default:
      text = "";
      colorClass = "bg-ink/5 text-ink/65";
  }

  if (!text) return null;

  return (
    <div className={`p-3 rounded-lg text-sm font-semibold ${colorClass}`}>
      {text}
    </div>
  );
}

function Hero({ compact }: { compact: boolean }) {
  return (
    <header
      className={`flex flex-col gap-4 rounded-lg border border-white/70 bg-white/70 shadow-soft backdrop-blur md:flex-row md:items-end md:justify-between ${
        compact ? "p-4" : "p-5 md:p-6"
      }`}
    >
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-sea">Tripwise</p>
        <h1 className={`mt-2 max-w-3xl font-black leading-tight text-ink ${compact ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl"}`}>
          Najdi nejlepší výlet, ne jen nejlevnější letenku.
        </h1>
        {!compact && (
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">
            Popiš, jaký výlet chceš. Tripwise porovná cenu, pohodlí, časy, rizika a hodnotu destinace.
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Kpi value="0-100" label="score" />
        <Kpi value="5" label="kritérií" />
        <Kpi value="Více" label="zdrojů" />
      </div>
    </header>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-20 rounded-lg border border-ink/10 bg-white px-3 py-2">
      <span className="block text-lg font-black text-ink">{value}</span>
      <span className="block text-xs font-bold uppercase tracking-wide text-ink/45">{label}</span>
    </div>
  );
}
