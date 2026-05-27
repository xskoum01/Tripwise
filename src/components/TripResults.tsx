import { FilterSummary } from "./FilterSummary";
import { ScoreBadge } from "./ScoreBadge";
import { TripCard } from "./TripCard";
import { buildScoreSummary, buildWarningSummary } from "./scoreCopy";
import type { ItineraryOption, SearchResponse } from "@/lib/search/types";

const linkLabels = {
  exact: "Otevřít nabídku",
  search: "Otevřít hledání",
  fallback: "Otevřít zdroj",
};

export function TripResults({ data }: { data: SearchResponse }) {
  const hasExact = data.exactResults.length > 0;
  const displayResults = hasExact ? data.exactResults : data.relaxedResults;
  const primaryTrip = hasExact ? data.featured.bestValue : data.relaxedResults[0];

  if (displayResults.length === 0) {
    return (
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <h2 className="text-xl font-black text-ink">Nic jsme nenašli</h2>
        <p className="mt-2 text-sm text-ink/65">V mock datech není ani blízká alternativa pro zadané podmínky.</p>
        <div className="mt-4">
          <FilterSummary request={data.appliedFilters} />
        </div>
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

      {hasExact && (
        <div className="grid gap-3 md:grid-cols-3">
          <Bucket title="Nejlevnější" trip={data.featured.cheapest} detail="Nejnižší celková cena" />
          <Bucket title="Nejkomfortnější" trip={data.featured.mostComfortable} detail="Nejlepší trasa a časy" />
          <Bucket title="Nejlepší víkendovka" trip={data.featured.bestWeekend} detail="Nejlépe sedí na víkend" />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="border-b border-ink/10 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-sea">Další možnosti</p>
          <h3 className="text-lg font-black text-ink">{hasExact ? "Porovnání přesných shod" : "Porovnání alternativ"}</h3>
        </div>
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
              {displayResults.map((trip) => (
                <tr key={trip.id} className="align-top">
                  <td className="px-5 py-4 font-bold text-ink">{trip.destination}</td>
                  <td className="px-5 py-4 text-ink/70">
                    {trip.dates.depart} - {trip.dates.return}
                    <span className="block text-xs">
                      {trip.nights} nocí z {trip.origin}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink/70">{trip.expectedTemperatureC} °C</td>
                  <td className="px-5 py-4 font-black text-ink">{trip.totalPrice.toLocaleString("cs-CZ")} Kč</td>
                  <td className="px-5 py-4 text-ink/70">{trip.direct ? "Přímý let" : `Přestup ${trip.layoverHours} h`}</td>
                  <td className="px-5 py-4">
                    <ScoreBadge score={trip.score ?? 0} label="score" />
                    <span className="mt-2 block max-w-44 text-xs font-semibold text-ink/60">{buildScoreSummary(trip)}</span>
                    {trip.warnings?.[0] && <span className="mt-1 block max-w-44 text-xs font-semibold text-coral">{buildWarningSummary(trip)}</span>}
                  </td>
                  <td className="px-5 py-4">
                    <a className="font-bold text-sea hover:text-ink" href={trip.sourceUrl} target="_blank" rel="noreferrer">
                      {linkLabels[trip.linkType]}
                    </a>
                    <span className="mt-1 block text-xs font-semibold text-ink/55">{trip.source}</span>
                    {trip.linkType === "fallback" && (
                      <span className="mt-1 block max-w-44 text-xs font-semibold text-ink/55">
                        Zdroj zatím neumí přesný odkaz, otevře se obecné vyhledávání.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
          <p className="mt-2 text-sm font-bold text-ink">{trip.totalPrice.toLocaleString("cs-CZ")} Kč</p>
        </div>
        <ScoreBadge score={trip.score ?? 0} label="score" />
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/65">{buildScoreSummary(trip)}</p>
      {trip.warnings?.[0] && <p className="mt-1 text-xs font-semibold text-coral">{buildWarningSummary(trip)}</p>}
    </article>
  );
}
