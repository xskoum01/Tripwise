"use client";

import { useEffect, useState } from "react";
import { extractIataFromFlightNumber, getAirlineLink } from "@/lib/search/airlineLinks";
import type { FlightSegment, ItineraryOption } from "@/lib/search/types";

function maskOfferId(id: string): string {
  const raw = id.startsWith("duffel-") ? id.slice(7) : id;
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 7)}…${raw.slice(-3)}`;
}

function buildGoogleFlightsUrl(trip: ItineraryOption): string {
  // Best-effort URL — may not match the exact Duffel offer
  try {
    const params = `${trip.origin}.${trip.destinationAirportCode}.${trip.dates.depart}*${trip.destinationAirportCode}.${trip.origin}.${trip.dates.return};c:CZK;e:1;sd:1;t:f`;
    return `https://www.google.com/travel/flights?hl=cs#flt=${params}`;
  } catch {
    return "https://www.google.com/travel/flights?hl=cs";
  }
}

function buildCopyText(trip: ItineraryOption, maskedId: string): string {
  const price =
    trip.priceCzk !== undefined
      ? `${trip.priceCzk.toLocaleString("cs-CZ")} Kč`
      : trip.totalPrice !== undefined
        ? `${trip.totalPrice.toLocaleString("cs-CZ")} ${trip.currency}`
        : "Neznámá";
  const originalPrice =
    trip.priceCzk !== undefined && trip.currency !== undefined && trip.currency !== "CZK" && trip.totalPrice !== undefined
      ? `${trip.totalPrice.toFixed(2)} ${trip.currency}`
      : undefined;

  const outFlights = trip.outboundSegments.map((s) => s.flightNumber).filter(Boolean).join(", ");
  const inFlights = trip.inboundSegments.map((s) => s.flightNumber).filter(Boolean).join(", ");

  return [
    `Destinace: ${trip.destination}${trip.country ? `, ${trip.country}` : ""}`,
    `Odlet: ${trip.dates.depart} z ${trip.origin} → ${trip.destinationAirportCode}`,
    `Návrat: ${trip.dates.return} z ${trip.destinationAirportCode} → ${trip.origin}`,
    outFlights ? `Čísla letů (odlet): ${outFlights}` : null,
    inFlights ? `Čísla letů (zpět): ${inFlights}` : null,
    `Letecká společnost: ${trip.airline ?? "Neznámá"}`,
    `Cena: ${price}`,
    originalPrice ? `Cena v původní měně: ${originalPrice}` : null,
    `ID nabídky: ${maskedId}`,
    `Zdroj: Duffel test režim — nabídka není závazná`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtDateTime(dt: string): string {
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
}

function SegmentRow({ seg }: { seg: FlightSegment }) {
  const duration =
    seg.durationMinutes !== undefined ? `${Math.floor(seg.durationMinutes / 60)}h ${seg.durationMinutes % 60}min` : undefined;
  return (
    <div className="rounded-lg border border-ink/10 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <span className="font-black text-ink">{seg.origin}</span>
        <span className="text-ink/40">→</span>
        <span className="font-black text-ink">{seg.destination}</span>
        {duration && <span className="ml-auto text-xs font-semibold text-ink/55">{duration}</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-ink/65">
        <span>Odlet: {fmtDateTime(seg.departureDateTime)}</span>
        <span>Přilet: {fmtDateTime(seg.arrivalDateTime)}</span>
      </div>
      {seg.carrierName && (
        <p className="mt-1 text-xs font-bold text-ink/70">
          {seg.carrierName}
          {seg.flightNumber ? ` · ${seg.flightNumber}` : ""}
        </p>
      )}
    </div>
  );
}

function SegmentSection({ title, segments }: { title: string; segments: FlightSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-sea">{title}</p>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <SegmentRow key={i} seg={seg} />
        ))}
      </div>
    </div>
  );
}

export function DuffelOfferDetail({ trip }: { trip: ItineraryOption }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const maskedId = maskOfferId(trip.providerResultId ?? trip.id);

  // Derive IATA code from the first outbound segment's flight number for airline link lookup
  const firstFlightNumber = trip.outboundSegments[0]?.flightNumber;
  const iataCode = extractIataFromFlightNumber(firstFlightNumber);
  const airlineLink = getAirlineLink(trip.airline, iataCode);

  const priceDisplay =
    trip.priceCzk !== undefined
      ? `${trip.priceCzk.toLocaleString("cs-CZ")} Kč`
      : trip.totalPrice !== undefined
        ? `${trip.totalPrice.toLocaleString("cs-CZ")} ${trip.currency}`
        : "Cena neznámá";
  const originalPrice =
    trip.priceCzk !== undefined && trip.currency !== undefined && trip.currency !== "CZK" && trip.totalPrice !== undefined
      ? `${trip.totalPrice.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${trip.currency}`
      : undefined;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildCopyText(trip, maskedId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable in some contexts
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-sea px-4 py-2 text-sm font-bold text-white transition hover:bg-ink"
      >
        Detail nabídky
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-sea">Duffel · Detail nabídky</p>
                <h2 className="text-xl font-black text-ink">
                  {trip.destination}
                  {trip.country ? `, ${trip.country}` : ""}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink"
                aria-label="Zavřít"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Price and offer metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-xs font-semibold text-ink/55">Cena celkem</span>
                  <span className="mt-1 block text-lg font-black text-ink">{priceDisplay}</span>
                  {originalPrice && <span className="block text-xs font-semibold text-ink/45">{originalPrice}</span>}
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-xs font-semibold text-ink/55">ID nabídky</span>
                  <span className="mt-1 block font-mono text-sm font-bold text-ink/70">{maskedId}</span>
                  <span className="block text-xs font-semibold text-ink/40">Duffel test režim</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-xs font-semibold text-ink/55">Letecká společnost</span>
                  <span className="mt-1 block font-bold text-ink">{trip.airline ?? "Neznámá"}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-xs font-semibold text-ink/55">Trasa</span>
                  <span className="mt-1 block font-bold text-ink">
                    {trip.direct ? "Přímý let" : `Přestup ${trip.layoverHours} h`}
                  </span>
                </div>
              </div>

              {/* Flight segments */}
              <SegmentSection title="Odlet" segments={trip.outboundSegments} />
              <SegmentSection title="Zpáteční let" segments={trip.inboundSegments} />

              {/* Baggage warning */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-800">Zavazadlo neověřeno</p>
                <p className="mt-1 text-sm font-semibold text-amber-700">
                  Informace o zavazadle nebyla parsována z odpovědi Duffel. Před rezervací ověř podmínky u dopravce.
                </p>
              </div>

              {/* Manual verification section */}
              <div className="rounded-lg border border-ink/10 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-sea">Ruční ověření</p>
                <p className="mt-2 text-xs font-semibold text-ink/65">
                  Duffel vrací API nabídku, ne veřejný odkaz na web aerolinky. Přesný nákup přes Tripwise bude možný až
                  po implementaci Duffel booking flow.
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href={buildGoogleFlightsUrl(trip)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sea/30 bg-white px-4 text-sm font-bold text-sea transition hover:border-sea hover:bg-mint"
                  >
                    Ověřit v Google Flights
                  </a>
                  {airlineLink && (
                    <a
                      href={airlineLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 text-sm font-bold text-ink/80 transition hover:border-ink/30 hover:text-ink"
                    >
                      Ověřit u aerolinky ({airlineLink.label})
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 text-sm font-bold text-ink transition hover:border-ink/30"
                  >
                    {copied ? "Zkopírováno!" : "Zkopírovat údaje"}
                  </button>
                </div>

                <p className="mt-3 text-xs font-semibold text-ink/50">
                  Otevře se ruční ověření. Nemusí jít o přesně stejnou Duffel nabídku.
                </p>
              </div>

              {/* Test-mode status note */}
              <p className="rounded-lg border border-ink/10 bg-white p-3 text-xs font-semibold text-ink/55">
                Toto je ověřená nabídka z Duffel test režimu. Tripwise zatím neumí vytvořit rezervaci. Před nákupem ověř
                dostupnost a cenu v booking flow nebo u zdroje.
                {/* TODO: implement order creation (POST /air/orders) once booking flow is approved */}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
