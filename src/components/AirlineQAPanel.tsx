"use client";

import { useState, useCallback } from "react";
import type { ItineraryOption } from "@/lib/search/types";

type QAMark = "search-ok" | "homepage-only" | "wrong-route" | "broken";
type QAEntry = { mark: QAMark; note: string; markedAt: string };

function extractAirlineId(tripId: string): string {
  return tripId.match(/^search-only-([a-z]+)-[A-Z]{3}-/)?.[1] ?? "unknown";
}

function buildNote(trip: ItineraryOption, mark: QAMark): string {
  const origin = trip.origin;
  const dest = trip.destinationAirportCode;
  const airline = trip.airline;
  switch (mark) {
    case "search-ok":
      return `Manual test: search URL opened correctly for ${origin} → ${dest}.`;
    case "homepage-only":
      return `Manual test: URL opened ${airline} homepage without prefilling for ${origin} → ${dest}.`;
    case "wrong-route":
      return `Manual test: URL opened but route or date was not prefilled correctly for ${origin} → ${dest}.`;
    case "broken":
      return `Manual test: URL resulted in error or unexpected redirect for ${origin} → ${dest}.`;
  }
}

function buildPatchSnippet(trip: ItineraryOption, entry: QAEntry): string {
  const airlineId = extractAirlineId(trip.id);
  const validationStatus = entry.mark === "search-ok" ? "manual-ok" : "manual-broken";
  const date = entry.markedAt;
  return `${airlineId}: {\n  validationStatus: "${validationStatus}",\n  lastValidatedAt: "${date}",\n  validationNote: "${entry.note}",\n},`;
}

function buildMarkdownSummary(markedTrips: Array<{ trip: ItineraryOption; entry: QAEntry }>): string {
  const header = "| Airline | Origin | Destination | Link kind | Confidence | Result | Note |";
  const sep = "|---------|--------|-------------|-----------|------------|--------|------|";
  const rows = markedTrips.map(({ trip, entry }) => {
    const linkKind = trip.linkType === "search" ? "hledání" : "web";
    const confidence = trip.linkConfidence ?? "—";
    const result = entry.mark;
    const note = entry.note.replace(/\|/g, "\\|");
    return `| ${trip.airline} | ${trip.origin} | ${trip.destinationAirportCode} | ${linkKind} | ${confidence} | ${result} | ${note} |`;
  });
  return [header, sep, ...rows].join("\n");
}

const markLabels: Record<QAMark, string> = {
  "search-ok": "✓ Funguje jako hledání",
  "homepage-only": "↩ Otevře jen web",
  "wrong-route": "⚠ Špatná trasa/datum",
  "broken": "✗ Rozbitý odkaz",
};

const markColors: Record<QAMark, { active: string; idle: string }> = {
  "search-ok": {
    active: "border-emerald-500 bg-emerald-50 text-emerald-800",
    idle: "border-ink/15 bg-white text-ink/70 hover:border-emerald-400 hover:bg-emerald-50/50",
  },
  "homepage-only": {
    active: "border-amber-500 bg-amber-50 text-amber-800",
    idle: "border-ink/15 bg-white text-ink/70 hover:border-amber-400 hover:bg-amber-50/50",
  },
  "wrong-route": {
    active: "border-orange-500 bg-orange-50 text-orange-800",
    idle: "border-ink/15 bg-white text-ink/70 hover:border-orange-400 hover:bg-orange-50/50",
  },
  "broken": {
    active: "border-coral bg-coral/10 text-coral",
    idle: "border-ink/15 bg-white text-ink/70 hover:border-coral/60 hover:bg-coral/5",
  },
};

export function AirlineQAPanel({ results, wish }: { results: ItineraryOption[]; wish?: string }) {
  const [qaState, setQaState] = useState<Record<string, QAEntry>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleMark = useCallback((trip: ItineraryOption, mark: QAMark) => {
    const now = new Date();
    const markedAt =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
    const note = buildNote(trip, mark);
    setQaState((prev) => ({
      ...prev,
      [trip.id]: { mark, note, markedAt },
    }));
  }, []);

  // Group by airline
  const byAirline: Record<string, ItineraryOption[]> = {};
  for (const trip of results) {
    const key = trip.airline || "Unknown";
    if (!byAirline[key]) byAirline[key] = [];
    byAirline[key].push(trip);
  }

  const markedCount = Object.keys(qaState).length;

  const markedTrips = results
    .filter((t) => qaState[t.id])
    .map((t) => ({ trip: t, entry: qaState[t.id] }));

  const markdownSummary = buildMarkdownSummary(markedTrips);

  return (
    <details className="mt-6 rounded-xl border-2 border-purple-300 bg-purple-50">
      <summary className="cursor-pointer select-none rounded-xl px-5 py-3 font-semibold text-purple-800 hover:bg-purple-100 list-none flex items-center gap-3">
        <span className="text-lg">🔍</span>
        <span>QA odkazy dopravců</span>
        <span className="ml-1 rounded-full bg-purple-200 px-2 py-0.5 text-xs font-bold text-purple-700">
          {results.length} výsledků
        </span>
        {markedCount > 0 && (
          <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
            {markedCount} označeno
          </span>
        )}
        {wish && (
          <span className="ml-auto text-xs font-normal text-purple-500 truncate max-w-xs">
            {wish}
          </span>
        )}
      </summary>

      <div className="px-5 pb-5 pt-3 space-y-6">
        {Object.entries(byAirline).map(([airline, trips]) => (
          <section key={airline}>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-purple-700">
              {airline}
              <span className="ml-2 font-normal text-purple-400">({trips.length})</span>
            </h3>

            <div className="space-y-4">
              {trips.map((trip) => {
                const entry = qaState[trip.id];
                const url = trip.sourceUrl;
                const linkKind = trip.linkType === "search" ? "hledání" : "web";
                const linkKindClass =
                  trip.linkType === "search"
                    ? "bg-sea/10 text-sea"
                    : "bg-ink/10 text-ink/60";
                const snippet = entry ? buildPatchSnippet(trip, entry) : null;
                const copyUrlKey = `url-${trip.id}`;
                const copySnippetKey = `snippet-${trip.id}`;

                return (
                  <div
                    key={trip.id}
                    className="rounded-lg border border-purple-200 bg-white p-4 space-y-3"
                  >
                    {/* Route header */}
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      <span>
                        {trip.origin} → {trip.destinationAirportCode}
                      </span>
                      <span className="text-ink/40">·</span>
                      <span className="text-ink/70">{trip.destination}</span>
                      <span className="text-ink/40">·</span>
                      <span className="text-ink/60 font-normal">
                        {trip.dates.depart} – {trip.dates.return}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${linkKindClass}`}>
                        {linkKind}
                      </span>
                      {trip.linkConfidence && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-600">
                          {trip.linkConfidence}
                        </span>
                      )}
                      {trip.linkValidationStatus && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
                          {trip.linkValidationStatus}
                        </span>
                      )}
                    </div>

                    {/* URL */}
                    <div className="rounded bg-slate-50 border border-slate-200 px-3 py-2">
                      <p
                        className="text-xs font-mono text-ink/80 break-all select-all"
                        title="Klikni a označ celou URL"
                      >
                        {url}
                      </p>
                    </div>

                    {/* Validation note */}
                    {trip.linkValidationNote && (
                      <p className="text-xs italic text-amber-600">{trip.linkValidationNote}</p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded border border-purple-400 bg-purple-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-purple-700"
                      >
                        Otevřít odkaz
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(copyUrlKey, url)}
                        className="inline-flex items-center rounded border border-ink/20 bg-white px-3 py-1 text-xs font-semibold text-ink/70 transition hover:bg-slate-50"
                      >
                        {copied === copyUrlKey ? "Zkopírováno ✓" : "Kopírovat URL"}
                      </button>

                      {(["search-ok", "homepage-only", "wrong-route", "broken"] as QAMark[]).map(
                        (mark) => {
                          const isActive = entry?.mark === mark;
                          const colors = markColors[mark];
                          return (
                            <button
                              key={mark}
                              type="button"
                              onClick={() => handleMark(trip, mark)}
                              className={`inline-flex items-center rounded border px-3 py-1 text-xs font-semibold transition ${isActive ? colors.active : colors.idle}`}
                            >
                              {markLabels[mark]}
                            </button>
                          );
                        }
                      )}
                    </div>

                    {/* Patch snippet */}
                    {entry && snippet && (
                      <div className="rounded bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">
                            airlineLinkValidation.ts patch
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(copySnippetKey, snippet)}
                            className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                          >
                            {copied === copySnippetKey ? "Zkopírováno ✓" : "Kopírovat"}
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all">
                          {snippet}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* QA Summary section */}
        {results.length > 0 && (
          <section className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-purple-700">
                QA souhrn — označeno {markedCount} z {results.length}
              </p>
              <button
                type="button"
                onClick={() => handleCopy("qa-summary", markdownSummary)}
                disabled={markedCount === 0}
                className="rounded border border-purple-400 bg-purple-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied === "qa-summary" ? "Zkopírováno ✓" : "Kopírovat QA souhrn"}
              </button>
            </div>
            {markedCount > 0 && (
              <pre className="rounded bg-white border border-purple-100 p-3 text-xs font-mono text-ink/70 overflow-x-auto whitespace-pre">
                {markdownSummary}
              </pre>
            )}
          </section>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-purple-400">
          Dev-only QA panel · nezapisuje soubory automaticky · použij Kopírovat a aktualizuj airlineLinkValidation.ts ručně
        </p>
      </div>
    </details>
  );
}
