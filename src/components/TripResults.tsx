import { DuffelOfferDetail } from "./DuffelOfferDetail";
import { FilterSummary } from "./FilterSummary";
import { ScoreBadge } from "./ScoreBadge";
import { TripCard } from "./TripCard";
import { buildScoreSummary, buildWarningSummary } from "./scoreCopy";
import { formatDateRangeCz, formatTripLengthCz } from "@/lib/format/date";
import type { ItineraryOption, LinkType, PostProcessDiagnostics, SearchResponse } from "@/lib/search/types";

const linkLabels: Record<LinkType, string> = {
  exact: "Otevřít nabídku",
  search: "Ověřit u zdroje",
  fallback: "Otevřít zdroj",
};

const availabilityLabels = {
  verified: "Ověřená nabídka",
  indicative: "Orientační",
  search: "Vyhledávání",
  fallback: "Fallback",
  mock: "Demo data",
};

const priceLabels = {
  live: "živá cena",
  cached: "cache",
  estimated: "odhad",
  unknown: "neznámá",
};

function displayLinkType(trip: ItineraryOption): LinkType {
  const linkType = trip.linkType ?? "fallback";
  return linkType === "exact" && trip.availabilityStatus !== "verified" ? "search" : linkType;
}

// Source badge renders a small pill that identifies the provider type at a glance.
function SourceBadge({ trip }: { trip: ItineraryOption }) {
  if (trip.isSandbox) {
    return <span className="mt-1 block rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">Sandbox</span>;
  }
  if (trip.provider === "ryanair-unofficial") {
    return <span className="mt-1 block rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">Neoficiální zdroj</span>;
  }
  if (trip.availabilityStatus === "verified") {
    return <span className="mt-1 block rounded bg-sea/10 px-1.5 py-0.5 text-xs font-semibold text-sea">Ověřená nabídka</span>;
  }
  if (trip.availabilityStatus === "mock") {
    return <span className="mt-1 block rounded bg-ink/5 px-1.5 py-0.5 text-xs font-semibold text-ink/50">Demo</span>;
  }
  return null;
}

// Action cell in the results table — link button or Duffel detail panel.
function SourceAction({ trip }: { trip: ItineraryOption }) {
  return (
    <td className="px-5 py-4">
      {trip.provider === "duffel" && trip.linkType === "fallback" ? (
        <DuffelOfferDetail trip={trip} />
      ) : trip.provider === "ryanair-unofficial" ? (
        <a className="font-bold text-amber-600 hover:text-ink" href={trip.sourceUrl} target="_blank" rel="noreferrer">
          Ověřit u Ryanairu
        </a>
      ) : (
        <a className="font-bold text-sea hover:text-ink" href={trip.sourceUrl} target="_blank" rel="noreferrer">
          {linkLabels[displayLinkType(trip)]}
        </a>
      )}
      <span className="mt-1 block text-xs font-semibold text-ink/55">{trip.source}</span>
      <span className="mt-1 block text-xs font-semibold text-ink/55">
        {availabilityLabels[trip.availabilityStatus]} · {trip.provider}
      </span>
      <SourceBadge trip={trip} />
      {displayLinkType(trip) === "fallback" && trip.provider !== "duffel" && trip.provider !== "ryanair-unofficial" && (
        <span className="mt-1 block max-w-44 text-xs font-semibold text-ink/55">
          {trip.linkNote ?? "Zdroj zatím neumí přesný odkaz."}
        </span>
      )}
    </td>
  );
}

// Table shared between primary results and sandbox section.
function ResultsTable({ results, relaxed = false }: { results: ItineraryOption[]; relaxed?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[960px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-ink/55">
          <tr>
            <th className="px-5 py-3">Destinace</th>
            <th className="px-5 py-3">Termín</th>
            <th className="px-5 py-3">Teplota</th>
            <th className="px-5 py-3">Cena</th>
            <th className="px-5 py-3">Trasa</th>
            <th className="px-5 py-3">Score</th>
            <th className="px-5 py-3">Zdroj</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {results.map((trip) => (
            <tr key={trip.id} className={`align-top ${relaxed ? "opacity-75" : ""}`}>
              <td className="px-5 py-4 font-bold text-ink">{trip.destination}</td>
              <td className="px-5 py-4 text-ink/70">
                {formatDateRangeCz(trip.dates.depart, trip.dates.return)}
                <span className="block text-xs">
                  {formatTripLengthCz(trip.nights)} · {trip.origin}
                </span>
              </td>
              <td className="px-5 py-4 text-ink/70">{trip.expectedTemperatureC !== undefined ? `${trip.expectedTemperatureC} °C` : "Neznámá"}</td>
              <td className="px-5 py-4 font-black text-ink">
                {trip.priceCzk !== undefined
                  ? `${trip.priceCzk.toLocaleString("cs-CZ")} Kč`
                  : trip.totalPrice !== undefined
                    ? `${trip.totalPrice.toLocaleString("cs-CZ")} ${trip.currency ?? "Kč"}`
                    : "Neznámá"}
                {trip.priceCzk !== undefined && trip.currency !== undefined && trip.currency !== "CZK" && trip.totalPrice !== undefined && (
                  <span className="block text-xs font-normal text-ink/45">
                    {trip.totalPrice.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {trip.currency}
                  </span>
                )}
                <span className="block text-xs font-semibold text-ink/50">{priceLabels[trip.priceStatus]}</span>
              </td>
              <td className="px-5 py-4 text-ink/70">{trip.direct ? "Přímý let" : `Přestup ${trip.layoverHours} h`}</td>
              <td className="px-5 py-4">
                <ScoreBadge score={trip.score ?? 0} label="score" />
                <span className="mt-2 block max-w-44 text-xs font-semibold text-ink/60">{buildScoreSummary(trip)}</span>
                {trip.warnings?.[0] && <span className="mt-1 block max-w-44 text-xs font-semibold text-coral">{buildWarningSummary(trip)}</span>}
              </td>
              <SourceAction trip={trip} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Collapsible section for search-only airline verification links.
// These are NOT priced results — they exist so the user can manually check airlines
// that Tripwise cannot query automatically.
function SearchOnlySection({ results }: { results: ItineraryOption[] }) {
  if (results.length === 0) return null;

  // Group by airline for cleaner display
  const byAirline = new Map<string, ItineraryOption[]>();
  for (const r of results) {
    const key = r.airline;
    if (!byAirline.has(key)) byAirline.set(key, []);
    byAirline.get(key)!.push(r);
  }

  return (
    <details className="overflow-hidden rounded-lg border border-ink/10 bg-white/80 shadow-soft" open>
      <summary className="cursor-pointer select-none border-b border-ink/10 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-ink/60">Další zdroje k ručnímu ověření</span>
        <span className="ml-2 text-xs font-semibold text-ink/40">({results.length} dopravců / tras)</span>
        <p className="mt-1 text-xs font-semibold text-ink/50">
          Tripwise u těchto dopravců automaticky nezískal cenu. Ověř ji ručně přímo u aerolinky.
        </p>
      </summary>
      <div className="divide-y divide-ink/5">
        {[...byAirline.entries()].map(([airlineName, trips]) => (
          <div key={airlineName} className="px-5 py-3">
            <p className="text-xs font-bold text-ink/70">{airlineName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {trips.map((trip) => (
                <a
                  key={trip.id}
                  href={trip.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-sea/30 hover:bg-sea/5 hover:text-sea"
                >
                  <span>{trip.origin} → {trip.destinationAirportCode}</span>
                  <span className="text-ink/40">·</span>
                  <span>{trip.destination}</span>
                  <span className="ml-1 rounded bg-ink/5 px-1 py-0.5 text-[10px] font-bold uppercase text-ink/40">
                    {trip.linkType === "search" ? "hledání" : "web"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-ink/5 px-5 py-2 text-[11px] font-semibold text-ink/40">
        Pouze ověřovací odkazy · bez garance ceny nebo dostupnosti · vždy ověř přímo u dopravce
      </p>
    </details>
  );
}

// Collapsible section for Duffel test mode sandbox results.
// Shown at the bottom, separate from real recommendations.
function SandboxSection({ results }: { results: ItineraryOption[] }) {
  if (results.length === 0) return null;

  return (
    <details className="overflow-hidden rounded-lg border border-orange-200 bg-orange-50/50 shadow-soft">
      <summary className="cursor-pointer select-none border-b border-orange-200 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-orange-600">Testovací Duffel výsledky</span>
        <span className="ml-2 text-xs font-semibold text-orange-500">({results.length})</span>
        <p className="mt-1 text-xs font-semibold text-orange-700/80">
          Duffel test mode vrací sandbox data. Nejde o reálné letenky pro nákup.
        </p>
      </summary>
      <div className="bg-white">
        <ResultsTable results={results} />
      </div>
    </details>
  );
}

export function TripResults({ data }: { data: SearchResponse }) {
  const hasExact = data.exactResults.length > 0;
  const displayResults = hasExact ? data.exactResults : data.relaxedResults;
  const primaryTrip = hasExact ? data.featured.bestValue : data.relaxedResults[0];

  if (displayResults.length === 0) {
    if (data.noActiveFlightProviders) {
      return (
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-ink">Nejsou připojené žádné reálné zdroje</h2>
          <p className="mt-2 text-sm text-ink/65">
            Tripwise je teď v režimu reálných providerů, ale žádný zdroj letenek nemá nakonfigurovaný API klíč. Proto nevracíme demo
            letenky jako reálné výsledky.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-ink/10 bg-slate-50 p-4">
              <p className="text-sm font-black text-ink">Reálná data (nastavení)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-ink/70">
                <li>KIWI_API_KEY nebo TEQUILA_API_KEY pro Kiwi/Tequila</li>
                <li>SKYSCANNER_API_KEY pro Skyscanner</li>
                <li>DUFFEL_ACCESS_TOKEN pro Duffel</li>
              </ul>
            </div>
            <div className="rounded-lg border border-ink/10 bg-slate-50 p-4">
              <p className="text-sm font-black text-ink">Demo režim</p>
              <p className="mt-2 text-sm font-semibold text-ink/70">Pro ladění UI můžeš zapnout ENABLE_MOCK_PROVIDER=true.</p>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-mint/40 px-3 py-2 text-sm font-bold text-ink/75">Po změně .env.local restartuj npm run dev.</p>

          <div className="mt-4">
            <FilterSummary request={data.appliedFilters} />
          </div>

          <TechnicalDetails warnings={data.providerWarnings} />
          <SearchOnlySection results={data.searchOnlyResults} />
          <SandboxSection results={data.sandboxResults} />
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-ink">Nic jsme nenašli</h2>
          <p className="mt-2 text-sm text-ink/65">Žádný zapnutý poskytovatel nevrátil výsledek pro zadané podmínky.</p>
          <div className="mt-4">
            <FilterSummary request={data.appliedFilters} />
          </div>
          <TechnicalDetails warnings={data.providerWarnings} />
        </div>
        <SearchOnlySection results={data.searchOnlyResults} />
        <SandboxSection results={data.sandboxResults} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sea">Tripwise doporučení</p>
            <h2 className="text-2xl font-black text-ink">{hasExact ? "Přesné shody podle zadání" : "Nemáme přesnou shodu pro zadané podmínky"}</h2>
          </div>
          <FilterSummary request={data.appliedFilters} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.providerStatuses.map((provider) => (
            <span
              key={provider.name}
              className={`rounded-full px-3 py-1 text-xs font-bold ${provider.enabled ? "bg-sea/10 text-sea" : "bg-ink/5 text-ink/50"}`}
              title={provider.message}
            >
              {provider.name}: {provider.enabled ? "zapnuto" : "vypnuto"}
            </span>
          ))}
        </div>
      </div>

      {!hasExact && (
        <div className="rounded-lg border border-coral/20 bg-coral/10 p-4 text-sm text-ink/75 shadow-soft">
          <p className="font-bold text-ink">Nejbližší alternativy</p>
          {data.relaxationMessages.map((message) => (
            <p key={message} className="mt-1">
              {message}
            </p>
          ))}
        </div>
      )}

      {primaryTrip && <TripCard trip={primaryTrip} featured relaxed={!hasExact} />}

      {data.assumptions.length > 0 && <p className="rounded-lg bg-white/70 px-4 py-2 text-xs text-ink/55 shadow-soft">{data.assumptions.join(" ")}</p>}
      <TechnicalDetails warnings={data.providerWarnings} />

      {hasExact && (
        <div className="grid gap-3 md:grid-cols-3">
          <Bucket title="Nejlevnější" trip={data.featured.cheapest} detail="Nejnižší celková cena" />
          <Bucket title="Nejkomfortnější" trip={data.featured.mostComfortable} detail="Nejlepší trasa a časy" />
          <Bucket title="Nejlepší víkendovka" trip={data.featured.bestWeekend} detail="Nejlépe sedí na víkend" />
        </div>
      )}

      {data.postProcessDiagnostics && <DiagnosticsLine diagnostics={data.postProcessDiagnostics} />}

      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="border-b border-ink/10 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-sea">Další možnosti</p>
          <h3 className="text-lg font-black text-ink">{hasExact ? "Porovnání přesných shod" : "Porovnání alternativ"}</h3>
        </div>
        <ResultsTable results={displayResults} relaxed={!hasExact} />
      </div>

      <SearchOnlySection results={data.searchOnlyResults} />
      <SandboxSection results={data.sandboxResults} />
    </section>
  );
}

function DiagnosticsLine({ diagnostics }: { diagnostics: PostProcessDiagnostics }) {
  const filtered = diagnostics.totalFromProviders - diagnostics.afterHardFilters;
  const deduped = diagnostics.afterHardFilters - diagnostics.afterDedup;
  const dominated = diagnostics.afterDedup - diagnostics.afterDominated;

  return (
    <details className="rounded-lg border border-ink/10 bg-white/80 px-4 py-3 text-xs font-semibold text-ink/55 shadow-soft">
      <summary className="cursor-pointer select-none">
        Nalezeno {diagnostics.totalFromProviders} nabídek · {filtered} odfiltrováno · {deduped + dominated} sloučeno/odstraněno · zobrazeno {diagnostics.displayed} nejlepších
      </summary>
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        <p>Celkem od providerů: {diagnostics.totalFromProviders}</p>
        <p>Po filtru rozpočtu/podmínek: {diagnostics.afterHardFilters}</p>
        <p>Po deduplikaci: {diagnostics.afterDedup}</p>
        <p>Po odstranění dominovaných: {diagnostics.afterDominated}</p>
        <p>Zobrazeno: {diagnostics.displayed}</p>
        {diagnostics.filteredOutCounts.overBudget > 0 && <p>Nad rozpočtem: {diagnostics.filteredOutCounts.overBudget}</p>}
        {diagnostics.filteredOutCounts.wrongTripLength > 0 && <p>Špatná délka pobytu: {diagnostics.filteredOutCounts.wrongTripLength}</p>}
        {diagnostics.filteredOutCounts.tooManyTransfers > 0 && <p>Příliš mnoho přestupů: {diagnostics.filteredOutCounts.tooManyTransfers}</p>}
        {diagnostics.unknownCurrencyCount > 0 && <p>Neznámá měna (odstraněno): {diagnostics.unknownCurrencyCount}</p>}
      </div>
    </details>
  );
}

function TechnicalDetails({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <details className="rounded-lg border border-ink/10 bg-white/80 px-4 py-3 text-xs font-semibold text-ink/60 shadow-soft">
      <summary className="cursor-pointer select-none text-sm font-black text-ink/70">Zobrazit technické detaily</summary>
      <div className="mt-3 space-y-1">
        {warnings.slice(0, 8).map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </details>
  );
}

function Bucket({ title, detail, trip }: { title: string; detail: string; trip?: ItineraryOption }) {
  if (!trip) return null;

  return (
    <article className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">{title}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink">{trip.destination}</h3>
          <p className="text-sm text-ink/60">{detail}</p>
          <p className="mt-1 text-xs font-semibold text-ink/60">
            {formatDateRangeCz(trip.dates.depart, trip.dates.return)} · {formatTripLengthCz(trip.nights)} · {trip.origin}
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {trip.totalPrice !== undefined ? `${trip.totalPrice.toLocaleString("cs-CZ")} ${trip.currency ?? "Kč"}` : "Cena neznámá"}
          </p>
          <p className="mt-1 text-xs font-semibold text-ink/55">
            {availabilityLabels[trip.availabilityStatus]} · {priceLabels[trip.priceStatus]}
          </p>
        </div>
        <ScoreBadge score={trip.score ?? 0} label="score" />
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/65">{buildScoreSummary(trip)}</p>
      {trip.warnings?.[0] && <p className="mt-1 text-xs font-semibold text-coral">{buildWarningSummary(trip)}</p>}
    </article>
  );
}
