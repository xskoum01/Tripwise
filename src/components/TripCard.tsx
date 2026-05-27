import { ScoreBadge } from "./ScoreBadge";
import { buildScoreSummary, buildStrengths, buildWarningSummary } from "./scoreCopy";
import type { ItineraryOption } from "@/lib/search/types";

const linkLabels = {
  exact: "Otevřít nabídku",
  search: "Otevřít hledání",
  fallback: "Otevřít zdroj",
};

const baggageLabels = {
  backpack: "batoh",
  cabin: "kabinové",
  checked: "odbavené",
};

export function TripCard({ trip, featured = false, relaxed = false }: { trip: ItineraryOption; featured?: boolean; relaxed?: boolean }) {
  const strengths = buildStrengths(trip);
  const warning = buildWarningSummary(trip);

  return (
    <article className={`rounded-lg border bg-white p-5 shadow-soft ${featured ? "border-sea ring-4 ring-sea/10 md:p-6" : "border-ink/10"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sea">
            {relaxed ? "Nejbližší alternativa" : featured ? "Nejlepší cena/výkon" : trip.source}
          </p>
          <h3 className={`${featured ? "text-3xl" : "text-2xl"} mt-1 font-black text-ink`}>
            {trip.destination}, {trip.country}
          </h3>
          <p className="mt-1 text-sm text-ink/65">
            {trip.dates.depart} - {trip.dates.return} · {trip.nights} nocí · odlet {trip.origin}
          </p>
        </div>
        <ScoreBadge score={trip.score ?? 0} />
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Cena celkem" value={`${trip.totalPrice.toLocaleString("cs-CZ")} Kč`} strong />
        <Metric label="Teplota" value={`${trip.expectedTemperatureC} °C`} />
        <Metric label="Let" value={`${trip.departureTime} tam · ${trip.returnTime} zpět`} />
        <Metric label="Dopravce" value={`${trip.airline} / ${trip.source}`} />
        <Metric label="Trasa" value={trip.direct ? "Přímý let" : `Přestup ${trip.layoverHours} h`} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
        <div className={`rounded-lg p-4 ${relaxed ? "bg-coral/10" : "bg-mint/70"}`}>
          <p className="text-sm font-black text-ink">{relaxed ? "Proč je to alternativa" : "Proč doporučujeme"}</p>
          <ul className="mt-2 grid gap-1 text-sm font-semibold text-ink/75 sm:grid-cols-3">
            {strengths.map((strength) => (
              <li key={strength}>Silné: {strength}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink/75">
            {relaxed && trip.relaxationReasons?.length
              ? `Toto je alternativa, protože ${trip.relaxationReasons.join(", ")}.`
              : trip.explanation}
          </p>
        </div>
        <div className="rounded-lg border border-coral/15 bg-coral/5 p-4">
          <p className="text-sm font-black text-coral">Klíčové upozornění</p>
          <p className="mt-2 text-sm font-semibold text-ink/75">{warning}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
            Zavazadlo: {trip.baggageIncluded.map((item) => baggageLabels[item]).join(", ")}
          </span>
          <span className="rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold text-sea">{buildScoreSummary(trip)}</span>
          {trip.warnings?.map((warning) => (
            <span key={warning} className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral">
              Pozor: {warning}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <a
            href={trip.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-sea"
          >
            {linkLabels[trip.linkType]}
          </a>
          {trip.linkType === "fallback" && (
            <p className="max-w-72 text-xs font-semibold text-ink/55">
              Zdroj zatím neumí přesný odkaz, otevře se obecné vyhledávání.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-slate-50 p-3">
      <span className="block text-xs font-semibold text-ink/55">{label}</span>
      <span className={`mt-1 block ${strong ? "text-lg font-black text-ink" : "font-bold text-ink/80"}`}>{value}</span>
    </div>
  );
}
