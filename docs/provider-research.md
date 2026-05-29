# Tripwise Provider Research

Personal research notes on airlines and providers relevant to low-cost trip hunting from CZ/SK/AT airports.

Origin scope: **PRG, VIE, BTS, BRQ, OSR, PED**

---

## Source Type Definitions

| Type | Description |
|---|---|
| **priced-unofficial** | Calls a public API-style endpoint not intended for programmatic use. Returns estimated prices. Personal use only. |
| **priced-official** | Uses an official airline or GDS API with a token. Returns verified bookable offers. |
| **search-only** | No price fetched. Generates a verification link to the airline website. |
| **future-research** | Endpoint/format not yet confirmed safe. Do not implement without verification. |
| **official-sandbox** | Official API in test mode. Prices are synthetic. |

---

## Airlines

### Ryanair

- **IATA codes**: FR
- **Origin airports in scope**: PRG, VIE, BTS, BRQ (seasonal), OSR (seasonal)
- **Source type**: priced-unofficial (fare-finder JSON endpoint)
- **Implementation status**: Implemented in `ryanairUnofficialAdapter.ts`
- **Link strategy**: Prefilled trip-select search URL
- **Risks**: Unofficial endpoint. Rate limits unknown. No SLA. Results are estimated, not bookable offers.
- **Notes**:
  - Enabled via `ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true`
  - Personal use only. Not for public production deployment.
  - Always shows "Neoficiální zdroj" badge.
  - Results are `availabilityStatus: "search"`, `priceStatus: "estimated"`.

---

### Wizz Air

- **IATA codes**: W6
- **Origin airports in scope**: PRG, VIE, BTS (hub), BRQ (seasonal)
- **Source type**: search-only
- **Implementation status**: Search-only link in `searchOnlyAirlineAdapter.ts`
- **Link strategy**: Homepage (search URL format not confirmed stable)
- **Risks**: No public priced JSON endpoint confirmed for personal use.
- **Future research**: Wizz Air has an unofficial availability API used by browser. Format changes frequently. Do not implement without thorough validation.
- **Notes**: Very strong from BTS (Bratislava hub). Worth manual checking for any Mediterranean route.

---

### Eurowings

- **IATA codes**: EW
- **Origin airports in scope**: VIE (main), PRG (occasional)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Subsidiary of Lufthansa Group. Focused on leisure routes from Austria/Germany.

---

### Vueling

- **IATA codes**: VY
- **Origin airports in scope**: PRG (seasonal), VIE (seasonal)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Strong from Barcelona. Useful for Iberian Peninsula connections.

---

### easyJet

- **IATA codes**: U2, EJU, EC
- **Origin airports in scope**: PRG, VIE
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Broad European network. Good for city breaks. No official public API for personal use identified.

---

### Smartwings

- **IATA codes**: QS
- **Origin airports in scope**: PRG (strong), BRQ (summer), OSR (summer), PED (summer charter)
- **Source type**: search-only (leisure charter)
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Czech leisure/charter carrier. Primarily summer season. Operates to Turkey, Egypt, Croatia, Spain, Canaries. No reliable public priced endpoint.

---

### Pegasus

- **IATA codes**: PC
- **Origin airports in scope**: PRG, VIE
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage (`flypgs.com`)
- **Link strategy**: Homepage
- **Notes**: Turkish low-cost. Strong routes to Turkey (AYT, SAW, ESB) and connecting destinations. Good complement to Ryanair for Turkey.

---

### SunExpress

- **IATA codes**: XQ
- **Origin airports in scope**: PRG, VIE (summer)
- **Source type**: search-only (seasonal leisure)
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Turkish-German leisure carrier. Summer season only. Good for Antalya, Bodrum routes.

---

### Transavia

- **IATA codes**: HV (Netherlands), TO (France)
- **Origin airports in scope**: PRG (seasonal)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Air France-KLM subsidiary. Good for Southern Europe from Amsterdam hub. Direct from PRG uncommon — check current schedule.

---

### Norwegian

- **IATA codes**: DY, D8
- **Origin airports in scope**: PRG, VIE (limited)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Reduced European network after 2021 restructuring. Useful for Scandinavia and some city breaks. Verify current PRG routes before suggesting.

---

### Volotea

- **IATA codes**: V7
- **Origin airports in scope**: VIE (occasional)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Southern European niche low-cost. Limited presence from our scope airports. Exploratory candidate.

---

### airBaltic

- **IATA codes**: BT
- **Origin airports in scope**: PRG, VIE (via Riga)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Baltic carrier. Useful for Riga connections and onward to Baltics, Scandinavia. Not a primary sea/warm candidate.

---

### AJet (formerly AnadoluJet)

- **IATA codes**: VF
- **Origin airports in scope**: PRG, VIE (via SAW/IST)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage (`ajet.com`)
- **Link strategy**: Homepage
- **Notes**: Turkish low-cost, rebrand of AnadoluJet. Routes through Sabiha Gökçen (SAW) and Antalya (AYT). Complement to Pegasus for Turkey routes.

---

### Corendon

- **IATA codes**: XC, CD, XR
- **Origin airports in scope**: PRG, VIE (summer charter)
- **Source type**: search-only (leisure charter)
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Dutch/Turkish leisure carrier. Summer season only. Turkey, Egypt, Canaries. Charter model — seats often sold through tour operators.

---

### Air Cairo

- **IATA codes**: SM
- **Origin airports in scope**: PRG, VIE, PED (summer charter to Egypt)
- **Source type**: search-only (leisure charter)
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: Egyptian leisure carrier. Hurghada (HRG) and Marsa Alam (RMF). Seasonal charter. Often sold bundled with hotel packages.

---

### Condor

- **IATA codes**: DE
- **Origin airports in scope**: PRG (occasional)
- **Source type**: search-only (leisure)
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: German leisure carrier. Long-haul and Canaries/Mediterranean. Verify current PRG schedule.

---

### Jet2

- **IATA codes**: LS
- **Origin airports in scope**: PRG (very limited)
- **Source type**: search-only
- **Implementation status**: Search-only link via homepage
- **Link strategy**: Homepage
- **Notes**: UK leisure low-cost. Very limited CZ market presence. Included for completeness. Exploratory candidate only.

---

## Aggregator Providers (Future)

### Google Flights Verification

- **Type**: manual verification link builder
- **Status**: Not implemented — backlog
- **Approach**: Build a `https://www.google.com/travel/flights/...` deep link for a given route/date pair.
- **Notes**: Useful as a fallback "verify this route" shortcut. Not a data source.

### Skyscanner Manual Verification

- **Type**: manual verification link builder (search URL already partially in `providerLinks.ts`)
- **Status**: Partial — Skyscanner search links are built in `buildSkyscannerSearchLink`
- **Notes**: Can be extended as a dedicated verification link helper.

---

## Origin Airport Notes

| Airport | Code | Airlines present | Notes |
|---|---|---|---|
| Praha | PRG | Ryanair, Wizz Air, easyJet, Smartwings, Vueling, Pegasus, SunExpress, AJet, Condor, airBaltic, Norwegian | Main hub. Broadest selection. |
| Vídeň | VIE | Ryanair, Wizz Air, easyJet, Eurowings, Pegasus, SunExpress, Volotea, airBaltic, Corendon, Air Cairo, AJet | Strong hub for Austria. Good Wizz Air / Eurowings coverage. |
| Bratislava | BTS | Ryanair (strong), Wizz Air (strong) | Ryanair and Wizz Air hub. Best option for SK/south Moravia travelers. |
| Brno | BRQ | Ryanair (seasonal), Smartwings (summer) | Limited year-round. Primarily summer season. |
| Ostrava | OSR | Ryanair (seasonal), Smartwings (summer) | Very limited. Summer season only. |
| Pardubice | PED | Smartwings (summer charter), Air Cairo (Egypt charter) | Charter-focused. Seasonal Egypt/Turkey packages. |

---

## Link Quality QA Checklist

Use this table to track manual validation of airline search URL patterns.

**How to manually test a link:**
1. Run Tripwise locally with `npm run dev`
2. Enter a search like "Chci v červenci k moři z Prahy"
3. Expand "Další zdroje k ručnímu ověření"
4. Click the `[dev] URL preview` triangle to see the full URL
5. Open the URL in a browser — check if route/date fields are prefilled
6. Update `airlineLinkValidation.ts` with the result and today's date

| Airline | Link kind | Confidence | Validation status | Last tested | Manual result | Notes |
|---|---|---|---|---|---|---|
| Ryanair | search | high | manual-ok | 2025-01-15 | ✓ Prefilled | `/trip/flights/select?originIata=...` works |
| Wizz Air | search | medium | untested | — | — | Path `/en-gb/booking/select-flight/...` observed |
| easyJet | search | medium | untested | — | — | `/en/cheap-flights/{org}/{dst}?departDate=` |
| Pegasus | search | medium | untested | — | — | `book.flypgs.com/en/round-trip?` DD/MM/YYYY dates |
| Norwegian | search | medium | untested | — | — | `/booking/flight/search/?D_City=...` |
| Eurowings | search | low | untested | — | — | SPA may ignore query params |
| Vueling | search | low | untested | — | — | SPA routing; params may be ignored |
| Transavia | search | low | untested | — | — | Path-based date format DDMMYYYY |
| SunExpress | search | low | untested | — | — | Seasonal; verify route exists |
| airBaltic | search | low | untested | — | — | React SPA; params may not deep-link |
| Smartwings | search | low | untested | — | — | booking.smartwings.com third-party engine |
| Condor | search | low | untested | — | — | JSP; DD.MM.YYYY dates |
| AJet | search | low | untested | — | — | Rebranded; URL may have changed |
| Volotea | search | low | untested | — | — | Small carrier; limited CZ routes |
| Jet2 | search | low | untested | — | — | DD-Mon-YYYY dates; limited CZ presence |
| Corendon | homepage | high | untested | — | — | Charter; no reliable booking URL |
| Air Cairo | homepage | high | untested | — | — | Charter; no reliable booking URL |

**When you test a link, update `src/lib/search/airlineLinkValidation.ts`:**
```typescript
airline: {
  validationStatus: "manual-ok",   // or "manual-broken"
  lastValidatedAt: "2026-MM-DD",
  validationNote: "What you observed...",
},
```

**If you mark a link `manual-broken`:** the builder automatically falls back to homepage — no code change needed.

---

## Safety Rules (always apply)

1. Never present search-only results as having a confirmed price.
2. Never implement browser automation, CAPTCHA bypass, or session/cookie injection.
3. Never commit secrets or API keys.
4. Every result must display `sourceConfidence` and appropriate warning text.
5. Unofficial priced results: "Neoficiální zdroj. Cena a dostupnost bez garance. Ověř u dopravce."
6. Search-only results: "Tripwise u tohoto zdroje automaticky nezískal cenu. Ověř cenu a dostupnost ručně."
7. Sandbox/test results: "Testovací data. Nejde o reálnou koupitelnou letenku."
