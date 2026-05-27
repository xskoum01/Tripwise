import type { AirportCode, DestinationMode, TravelSearchRequest } from "@/lib/search/types";

const airportLabels: Record<AirportCode, string> = {
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
  const parts = [
    `Odlet: ${request.origins.map((origin) => airportLabels[origin]).join(", ")}`,
    request.targetMonth ? `Termín: ${monthLabels[request.targetMonth - 1]} ${yearFromDate(request.dateFrom)}` : undefined,
    `Typ: ${destinationLabels[request.destinationMode]}`,
    request.minTemperatureC ? `Teplota: alespoň ${request.minTemperatureC} °C` : undefined,
    request.maxBudget ? `Rozpočet: do ${request.maxBudget.toLocaleString("cs-CZ")} Kč` : undefined,
    `${request.minNights ?? 1}-${request.maxNights ?? 14} nocí`,
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
