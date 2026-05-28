"use client";

import { useState } from "react";
import { FilterSummary } from "./FilterSummary";
import { TripResults } from "./TripResults";
import type { OriginAirport, SearchResponse, TravelSearchRequest } from "@/lib/search/types";

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

const savedSearches = ["Moře do 7 000 Kč z Prahy", "Listopad u moře z Pardubic", "City break s přímým letem"];

export function SearchPanel() {
  const [wish, setWish] = useState("Chci v červnu na 3-5 dní k moři do 7 000 Kč, odlet Praha nebo Vídeň, nechci odlet před 6 ráno.");
  const [origins, setOrigins] = useState<OriginAirport[]>(["PRG", "VIE"]);
  const [maxBudget, setMaxBudget] = useState(7000);
  const [directOnly, setDirectOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [editing, setEditing] = useState(false);

  const hasResults = Boolean(results);
  const showSearchForm = !hasResults || editing;

  function syncControls(request: TravelSearchRequest) {
    setOrigins(request.origins);
    setMaxBudget(request.maxBudget ?? 7000);
    setDirectOnly(request.directOnly);
  }

  function toggleOrigin(code: OriginAirport) {
    setOrigins((current) => (current.includes(code) ? current.filter((origin) => origin !== code) : [...current, code]));
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);

    const payload: Partial<TravelSearchRequest> & { wish: string } = {
      wish,
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
                onClick={handleSearch}
                disabled={loading}
                className="min-h-11 w-full rounded-lg bg-ink px-4 text-sm font-black text-white transition hover:bg-sea disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Hledám..." : hasResults ? "Aktualizovat výsledky" : "Vyhledat"}
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

      {results && !loading && <TripResults data={results} />}
      {hasResults && <SavedSearchesStrip />}
      {!hasResults && <SavedSearchesPanel />}
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

function SavedSearchesPanel() {
  return (
    <aside className="rounded-lg border border-ink/10 bg-white/85 p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">Uložené inspirace</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {savedSearches.map((item) => (
          <button key={item} type="button" className="rounded-full border border-ink/10 bg-slate-50 px-3 py-1 text-xs font-bold text-ink/65">
            {item}
          </button>
        ))}
      </div>
    </aside>
  );
}

function SavedSearchesStrip() {
  return (
    <section className="rounded-lg border border-ink/10 bg-white/80 p-3 shadow-soft">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50 md:min-w-32">Uložené inspirace</p>
        <div className="flex flex-wrap gap-2">
          {savedSearches.map((item) => (
            <button key={item} type="button" className="rounded-full border border-ink/10 bg-slate-50 px-3 py-1 text-xs font-bold text-ink/65">
              {item}
            </button>
          ))}
        </div>
      </div>
    </section>
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
