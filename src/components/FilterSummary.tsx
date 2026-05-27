import type { DestinationMode, OriginAirport, TravelSearchRequest } from "@/lib/search/types";
import { formatDateRangeCz, formatTripLengthCz } from "@/lib/format/date";

const airportLabels: Record<OriginAirport, string> = {
  PRG: "Praha (PRG)",
  VIE: "Vídeň (VIE)",
  BRQ: "Brno (BRQ)",
  PED: "Pardubice (PED)",
};

const destinationLabels: Record<DestinationMode, string> = {
  any: "libovolně",
  sea: "k moři",
  warm: "za teplem",
  cityBreak: "město",
};

const monthLabels = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

function yearFromDate(date?: string) {
  return date ? date.slice(0, 4) : undefined;
}

export function FilterSummary({ request, compact = false }: { request: TravelSearchRequest; compact?: boolean }) {
  const dateRange = request.dateFrom && request.dateTo ? formatDateRangeCz(request.dateFrom, request.dateTo) : undefined;
  const nightRange =
    request.minNights === request.maxNights && request.minNights !== undefined
      ? formatTripLengthCz(request.minNights)
      : `${request.minNights ?? 1}-${formatTripLengthCz(request.maxNights ?? 14)}`;
  const parts = [
    `Odlet: ${request.origins.map((origin) => airportLabels[origin]).join(", ")}`,
    dateRange ?? (request.targetMonth ? `Termín: ${monthLabels[request.targetMonth - 1]} ${yearFromDate(request.dateFrom)}` : undefined),
    `Typ: ${destinationLabels[request.destinationMode]}`,
    request.minTemperatureC ? `Teplota: alespoň ${request.minTemperatureC} °C` : undefined,
    request.maxBudget ? `Rozpočet: do ${request.maxBudget.toLocaleString("cs-CZ")} Kč` : undefined,
    nightRange,
    `Pouze přímý let: ${request.directOnly ? "ano" : "ne"}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2">
      {parts.map((part) => (
        <span
          key={part}
          className={`rounded-full border border-ink/10 bg-white font-semibold text-ink/75 ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs"}`}
        >
          {part}
        </span>
      ))}
    </div>
  );
}
