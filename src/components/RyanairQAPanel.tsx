"use client";

import { useState } from "react";
import type { ItineraryOption } from "@/lib/search/types";

type QAStatus = "ok" | "price-mismatch" | "link-broken" | null;

interface RyanairQAPanelProps {
  results: ItineraryOption[];
}

function statusLabel(status: QAStatus): string {
  if (status === "ok") return "Sedí";
  if (status === "price-mismatch") return "Cena nesedí";
  if (status === "link-broken") return "Odkaz nefunguje";
  return "neoznačeno";
}

function StatusBadge({ status }: { status: QAStatus }) {
  const base = "inline-block px-2 py-0.5 rounded-full text-xs font-semibold";
  if (status === "ok") return <span className={`${base} bg-emerald-100 text-emerald-800`}>Sedí</span>;
  if (status === "price-mismatch") return <span className={`${base} bg-amber-100 text-amber-800`}>Cena nesedí</span>;
  if (status === "link-broken") return <span className={`${base} bg-red-100 text-red-800`}>Odkaz nefunguje</span>;
  return <span className={`${base} bg-gray-100 text-gray-500`}>neoznačeno</span>;
}

export function RyanairQAPanel({ results }: RyanairQAPanelProps) {
  const [qaState, setQaState] = useState<Record<string, QAStatus>>({});

  if (results.length === 0) return null;

  function setStatus(id: string, newStatus: QAStatus) {
    setQaState((prev) => ({
      ...prev,
      [id]: prev[id] === newStatus ? null : newStatus,
    }));
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  function buildFlightText(trip: ItineraryOption): string {
    return [
      "Ryanair neoficiální výsledek",
      `Trasa: ${trip.origin} → ${trip.destinationAirportCode} → ${trip.origin}`,
      `Termín: ${trip.dates.depart} – ${trip.dates.return}`,
      `Časy: odlet ${trip.departureTime}, zpět ${trip.returnTime}`,
      `Cena Tripwise: ${trip.priceCzk != null ? trip.priceCzk.toLocaleString("cs-CZ") : "?"} Kč / ${trip.totalPrice ?? "?"} EUR`,
      `Ověřovací odkaz: ${trip.sourceUrl}`,
      "Poznámka: Cena a dostupnost bez garance, ověř u Ryanairu.",
    ].join("\n");
  }

  function buildSummaryMarkdown(): string {
    const header = "| Trasa | Termín | Cena Tripwise | QA výsledek |\n|---|---|---|---|";
    const rows = results.map((trip) => {
      const trasa = `${trip.origin} → ${trip.destinationAirportCode} → ${trip.origin}`;
      const termin = `${trip.dates.depart} – ${trip.dates.return}`;
      const cena = `${trip.priceCzk != null ? trip.priceCzk.toLocaleString("cs-CZ") : "?"} Kč`;
      const qa = statusLabel(qaState[trip.id] ?? null);
      return `| ${trasa} | ${termin} | ${cena} | ${qa} |`;
    });
    return [header, ...rows].join("\n");
  }

  return (
    <details
      open
      className="border-2 border-amber-400 rounded-lg bg-amber-50 p-3 my-4"
    >
      <summary className="cursor-pointer font-bold text-amber-800 text-sm select-none flex items-center gap-2">
        <span>Ryanair QA ({results.length})</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            copyText(buildSummaryMarkdown());
          }}
          className="ml-auto text-xs font-medium bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-0.5 rounded"
        >
          Kopírovat Ryanair QA souhrn
        </button>
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        {results.map((trip) => {
          const current = qaState[trip.id] ?? null;
          return (
            <div
              key={trip.id}
              className="border border-amber-300 rounded bg-white p-3 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-sm text-gray-800">
                  {trip.origin} → {trip.destinationAirportCode} → {trip.origin}
                </span>
                <span className="text-xs text-gray-500">
                  {trip.dates.depart} – {trip.dates.return}
                </span>
                <span className="text-xs text-gray-500">
                  odlet {trip.departureTime} / zpět {trip.returnTime}
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {trip.priceCzk != null ? trip.priceCzk.toLocaleString("cs-CZ") : "?"} Kč
                  {trip.totalPrice != null ? ` / ${trip.totalPrice} EUR` : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={trip.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Otevřít u Ryanairu
                </a>
                <button
                  type="button"
                  onClick={() => copyText(trip.sourceUrl)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                >
                  Kopírovat URL
                </button>
                <button
                  type="button"
                  onClick={() => copyText(buildFlightText(trip))}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                >
                  Kopírovat údaje letu
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(trip.id, "ok")}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                    current === "ok"
                      ? "bg-emerald-200 border-emerald-500 text-emerald-900"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-emerald-50"
                  }`}
                >
                  Sedí trasa/datum
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(trip.id, "price-mismatch")}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                    current === "price-mismatch"
                      ? "bg-amber-200 border-amber-500 text-amber-900"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-amber-50"
                  }`}
                >
                  Cena nesedí
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(trip.id, "link-broken")}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                    current === "link-broken"
                      ? "bg-red-200 border-red-500 text-red-900"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-red-50"
                  }`}
                >
                  Odkaz nefunguje
                </button>
                <StatusBadge status={current} />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
