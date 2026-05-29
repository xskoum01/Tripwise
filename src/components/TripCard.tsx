import { DuffelOfferDetail } from "./DuffelOfferDetail";
import { ScoreBadge } from "./ScoreBadge";
import { buildScoreSummary, buildStrengths, buildWarningSummary } from "./scoreCopy";
import { formatDateRangeCompactCz, formatDateRangeCz, formatTripLengthCz } from "@/lib/format/date";
import type { ItineraryOption, LinkType, OriginAirport } from "@/lib/search/types";

const linkLabels: Record<LinkType, string> = {
  exact: "Otevřít nabídku",
  search: "Ověřit u zdroje",
  fallback: "Otevřít zdroj",
};

const originLabels: Record<OriginAirport, string> = {
  PRG: "Praha (PRG)",
  VIE: "Vídeň (VIE)",
  BTS: "Bratislava (BTS)",
  BRQ: "Brno (BRQ)",
  OSR: "Ostrava (OSR)",
  PED: "Pardubice (PED)",
};

const baggageLabels = {
  backpack: "batoh",
  cabin: "kabinové",
  checked: "odbavené",
};

const availabilityLabels = {
  verified: "Ověřená dostupná nabídka",
  indicative: "Orientační dostupnost",
  search: "Vyhledávání u zdroje",
  fallback: "Obecný zdroj",
  mock: "Demo data",
};

const priceLabels = {
  live: "živá cena",
  cached: "orientační cena z cache",
  estimated: "odhadovaná cena",
  unknown: "cena neznámá",
};

function TripCostBreakdown({ estimate }: { estimate: NonNullable<ItineraryOption["tripCostEstimate"]> }) {
  const confidenceBadge =
    estimate.confidence === "medium" ? (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        střední jistota
      </span>
    ) : estimate.confidence === "low" ? (
      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold text-ink/50">
        odhad
      </span>
    ) : null;

  return (
    <div className="mt-3 rounded-lg border border-ink/10 bg-white p-3 text-xs">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-bold text-ink/70">Rozpis nákladů</span>
        {confidenceBadge}
      </div>
      <ul className="grid gap-0.5 text-ink/65">
        <li>
          Letenka:{" "}
          {estimate.flightPriceCzk !== undefined ? (
            <span className="font-semibold">{estimate.flightPriceCzk.toLocaleString("cs-CZ")} Kč</span>
          ) : (
            <span className="italic text-ink/45">Cena letenky neznámá</span>
          )}
        </li>
        {estimate.originAccessCostCzk !== undefined && (
          <li>
            Cesta na letiště:{" "}
            <span className="font-semibold">+{estimate.originAccessCostCzk.toLocaleString("cs-CZ")} Kč</span>
          </li>
        )}
        {estimate.destinationTransferCostCzk !== undefined && (
          <li>
            Transfer:{" "}
            <span className="font-semibold">+{estimate.destinationTransferCostCzk.toLocaleString("cs-CZ")} Kč</span>
          </li>
        )}
        {estimate.accommodationEstimateCzk !== undefined && (
          <li>
            Ubytování odhad:{" "}
            <span className="font-semibold">+{estimate.accommodationEstimateCzk.toLocaleString("cs-CZ")} Kč</span>
          </li>
        )}
        {estimate.totalEstimateCzk !== undefined && (
          <li className="mt-1 border-t border-ink/10 pt-1 font-bold text-ink/80">
            Celkem odhad: {estimate.totalEstimateCzk.toLocaleString("cs-CZ")} Kč
          </li>
        )}
      </ul>
      <p className="mt-1.5 text-[10px] text-ink/40">Celková cena je orientační odhad.</p>
    </div>
  );
}

function WeatherBadge({ temperatureC, confidence }: { temperatureC?: number; confidence?: string }) {
  if (temperatureC !== undefined && confidence === "forecast") {
    return (
      <span className="rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold text-sea">
        {temperatureC}°C · předpověď
      </span>
    );
  }
  if (temperatureC !== undefined && confidence === "climate") {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        {temperatureC}°C · klimatický odhad
      </span>
    );
  }
  if (temperatureC !== undefined && confidence === "unknown") {
    return (
      <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/50">
        {temperatureC}°C · neověřeno
      </span>
    );
  }
  if (temperatureC === undefined && confidence === "unknown") {
    return <span className="text-xs font-semibold text-ink/45">počasí neznámé</span>;
  }
  return null;
}

function DisclaimerNote({ confidence }: { confidence?: string }) {
  if (confidence === "climate") {
    return (
      <p className="mt-1 text-[10px] italic text-amber-700/70">
        Klimatický odhad podle historického/modelového počasí, ne přesná předpověď.
      </p>
    );
  }
  return null;
}

function WeatherNote({ trip }: { trip: ItineraryOption }) {
  const warnings = trip.warnings ?? [];

  const tempFailWarning = warnings.find((w) => w.startsWith("Nesplňuje požadavek na teplotu"));
  if (tempFailWarning) {
    return (
      <p className="mt-1 text-xs font-semibold text-coral">
        {tempFailWarning}
      </p>
    );
  }

  const rainWarning = warnings.find(
    (w) => w.startsWith("Nesplňuje požadavek bez deště") || w.startsWith("Vyšší srážky"),
  );
  if (rainWarning) {
    return (
      <p className="mt-1 text-xs font-semibold text-amber-600">
        {rainWarning}
      </p>
    );
  }

  const unknownWeatherWarning = warnings.find(
    (w) => w.startsWith("Srážky pro tento") || w.startsWith("Počasí pro tento"),
  );
  if (unknownWeatherWarning) {
    return (
      <p className="mt-1 text-xs font-semibold text-amber-600">
        {unknownWeatherWarning}
      </p>
    );
  }

  const goodTemp =
    trip.expectedTemperatureC !== undefined &&
    trip.expectedTemperatureC >= 24 &&
    (trip.weatherConfidence === "forecast" || trip.weatherConfidence === "climate");

  const lowPrecip =
    trip.expectedPrecipitationMmPerDay !== undefined && trip.expectedPrecipitationMmPerDay < 4;

  if (goodTemp || lowPrecip) {
    return (
      <>
        {goodTemp && (
          <p className="mt-1 text-xs font-semibold text-sea">
            Dobrá volba pro teplo: průměrně {trip.expectedTemperatureC} °C
          </p>
        )}
        {lowPrecip && (
          <p className="mt-1 text-xs font-semibold text-sea">
            Nízké srážky: {trip.expectedPrecipitationMmPerDay} mm/den
          </p>
        )}
      </>
    );
  }

  return null;
}

export function TripCard({ trip, featured = false, relaxed = false }: { trip: ItineraryOption; featured?: boolean; relaxed?: boolean }) {
  const strengths = buildStrengths(trip);
  const warning = buildWarningSummary(trip);
  const linkType = trip.linkType ?? "fallback";
  const displayLinkType = linkType === "exact" && trip.availabilityStatus !== "verified" ? "search" : linkType;
  const dateRange = formatDateRangeCz(trip.dates.depart, trip.dates.return);
  const compactDateRange = formatDateRangeCompactCz(trip.dates.depart, trip.dates.return);
  const tripLength = formatTripLengthCz(trip.nights);
  const originLabel = originLabels[trip.origin] ?? trip.origin;
  const price =
    trip.priceCzk !== undefined
      ? `${trip.priceCzk.toLocaleString("cs-CZ")} Kč`
      : trip.totalPrice !== undefined
        ? `${trip.totalPrice.toLocaleString("cs-CZ")} ${trip.currency ?? "Kč"}`
        : "Cena neznámá";
  const originalPrice =
    trip.priceCzk !== undefined && trip.currency !== undefined && trip.currency !== "CZK" && trip.totalPrice !== undefined
      ? `${trip.totalPrice.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${trip.currency}`
      : undefined;
  const totalTripEstimateCzk =
    trip.totalTripEstimateCzk ??
    trip.tripCostEstimate?.totalEstimateCzk;
  const temperature = trip.expectedTemperatureC !== undefined ? `${trip.expectedTemperatureC} °C` : "Neznámá";
  const destinationTitle = trip.country ? `${trip.destination}, ${trip.country}` : trip.destination;
  const baggage = trip.baggageIncluded?.length ? trip.baggageIncluded.map((item) => baggageLabels[item]).join(", ") : "neznámé";
  const availabilityNote =
    trip.availabilityNote ??
    (displayLinkType === "search"
      ? "Otevře se vyhledávání u dopravce. Dostupnost konkrétního dne nemusí být garantovaná."
      : "Orientační výsledek z MVP dat. Cenu a dostupnost ověř u dopravce.");

  return (
    <article className={`rounded-lg border bg-white p-5 shadow-soft ${featured ? "border-sea ring-4 ring-sea/10 md:p-6" : "border-ink/10"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sea">
            {relaxed ? "Nejbližší alternativa" : featured ? "Nejlepší cena/výkon" : trip.source}
          </p>
          <h3 className={`${featured ? "text-3xl" : "text-2xl"} mt-1 font-black text-ink`}>
            {destinationTitle}
          </h3>
          <p className="mt-1 text-sm text-ink/65">
            {dateRange} · {tripLength} · odlet {originLabel}
          </p>
        </div>
        <ScoreBadge score={trip.score ?? 0} />
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Termín" value={compactDateRange} subtext={tripLength} strong />
        <div className="rounded-lg border border-ink/10 bg-slate-50 p-3">
          <span className="block text-xs font-semibold text-ink/55">Cena celkem</span>
          <span className="mt-1 block text-lg font-black text-ink">{price}</span>
          {totalTripEstimateCzk !== undefined && (
            <span className="mt-0.5 block text-xs font-semibold text-sea/80">
              Celkem odhad: {totalTripEstimateCzk.toLocaleString("cs-CZ")} Kč
            </span>
          )}
          <span className="mt-1 block text-xs font-semibold text-ink/50">
            {originalPrice ?? priceLabels[trip.priceStatus]}
          </span>
          {trip.tripCostEstimate && (
            <TripCostBreakdown estimate={trip.tripCostEstimate} />
          )}
        </div>
        <div className="rounded-lg border border-ink/10 bg-slate-50 p-3">
          <span className="block text-xs font-semibold text-ink/55">Teplota</span>
          <span className="mt-1 block font-bold text-ink/80">{temperature}</span>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <WeatherBadge temperatureC={trip.expectedTemperatureC} confidence={trip.weatherConfidence} />
          </div>
          <DisclaimerNote confidence={trip.weatherConfidence} />
          <WeatherNote trip={trip} />
        </div>
        <Metric label="Let" value={`${trip.departureTime} tam · ${trip.returnTime} zpět`} />
        <Metric label="Zdroj" value={`${trip.source}`} subtext={trip.provider} />
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
          <p className="mt-2 text-xs font-semibold text-ink/60">{availabilityNote}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
            Zavazadlo: {baggage}
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">{availabilityLabels[trip.availabilityStatus]}</span>
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">{priceLabels[trip.priceStatus]}</span>
          <span className="rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold text-sea">{buildScoreSummary(trip)}</span>
          <WeatherBadge temperatureC={trip.expectedTemperatureC} confidence={trip.weatherConfidence} />
          {trip.provider === "ryanair-unofficial" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Neoficiální zdroj</span>
          )}
          {trip.warnings?.map((warning) => (
            <span key={warning} className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral">
              Pozor: {warning}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          {trip.provider === "duffel" && trip.linkType === "fallback" ? (
            <DuffelOfferDetail trip={trip} />
          ) : trip.provider === "ryanair-unofficial" ? (
            <a
              href={trip.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              Ověřit u Ryanairu
            </a>
          ) : (
            <a
              href={trip.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-sea"
            >
              {linkLabels[displayLinkType]}
            </a>
          )}
          <p className="max-w-72 text-xs font-semibold text-ink/55">{displayLinkType === "fallback" ? trip.linkNote ?? "Zdroj zatím neumí přesný odkaz." : availabilityNote}</p>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, subtext, strong = false }: { label: string; value: string; subtext?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-slate-50 p-3">
      <span className="block text-xs font-semibold text-ink/55">{label}</span>
      <span className={`mt-1 block ${strong ? "text-lg font-black text-ink" : "font-bold text-ink/80"}`}>{value}</span>
      {subtext && <span className="mt-1 block text-xs font-semibold text-ink/50">{subtext}</span>}
    </div>
  );
}
