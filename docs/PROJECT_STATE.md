# Tripwise — Project State

## Goal

Personal low-cost trip finder for CZ/SK/AT region. Natural language search (Czech) → ranked flight options with links to book or verify at source. Not a booking engine.

## Architecture

```
src/
  app/
    page.tsx                   — main UI (SearchPanel + TripResults)
    api/search/route.ts        — POST /api/search → SearchResponse
    api/providers/status/      — GET provider health
  lib/
    search/
      parseTravelWish.ts       — NL → TravelSearchRequest (Czech parser)
      searchService.ts         — orchestrates providers, scoring, post-processing
      postProcessResults.ts    — dedup, dominated-offer removal, hard filtering
      scoring.ts               — per-option score (price/comfort/timing/risk/dest)
      adapters/                — one file per provider
      types.ts                 — all shared types
      tripCost.ts              — total trip cost estimator (flight + access + accommodation)
      airports.ts              — AIRPORT_COST_PROFILES (single source of truth)
      airlineLinks.ts          — airline search URL builders
      airlineLinkValidation.ts — manual QA validation state
      scoring.ts               — composite score + explanations
    savedSearches/
      storage.ts               — localStorage persistence
      useSavedSearches.ts      — React hook
      batchRunner.ts           — re-run saved searches
    weather/
      openMeteoService.ts      — Open-Meteo forecast + climate enrichment
    config/env.ts              — server env flags
    providers/status.ts        — provider status registry
  components/
    SearchPanel.tsx            — wish input + options
    TripResults.tsx            — results table + diagnostics + QA panel
    TripCard.tsx               — featured trip card (with budget type notes)
    FilterSummary.tsx          — active filter pills (budget label reflects budgetType)
    SavedSearches.tsx          — saved search list + batch rerun
    AirlineQAPanel.tsx         — dev-only link QA workflow
    BatchRunPanel.tsx          — batch rerun UI
```

## Provider Types

| Type | Examples | Notes |
|------|----------|-------|
| priced-official | Kiwi, Duffel (live), Skyscanner Live | Real prices, bookable |
| priced-unofficial | ryanair-unofficial | Public endpoint, no guarantee |
| search-only | airline-search-link | No price — search URL only |
| test/sandbox | Duffel test mode | Synthetic data, never bookable |
| weather/enrichment | open-meteo | Temperature + precipitation |
| demo | mock | Dev/UI testing only |

## Important Env Flags

| Flag | Purpose |
|------|---------|
| `KIWI_API_KEY` / `TEQUILA_API_KEY` | Kiwi/Tequila provider |
| `SKYSCANNER_API_KEY` | Skyscanner live/indicative |
| `DUFFEL_ACCESS_TOKEN` | Duffel (test if token is test mode) |
| `ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true` | Opt-in to unofficial Ryanair endpoint |
| `ENABLE_MOCK_PROVIDER=true` | Enable mock/demo data |
| `ENABLE_AIRLINE_SEARCH_LINKS=true` | Enable search-only airline links |
| `SHOW_DUFFEL_TEST_RESULTS=true` | Show sandbox results in main section |

## Budget Semantics (as of June 2026)

`TravelSearchRequest.budgetType`:
- `"flight"` (default) — maxBudget applies to flight price only. Total trip estimate shown as informational.
- `"total"` — maxBudget applies to totalTripEstimateCzk. Hard filter removes results where estimate > budget.
- `"unknown"` — treated as `"flight"`.

Parser rules (Czech NL):
- "letenky/letenka/let do X" → `flight`
- "výlet do X celkem / celkově / se vším" → `total`
- plain "do X Kč" → `flight` (safe default)

## Current Limitations

- Ryanair unofficial endpoint can be blocked or change without notice.
- Duffel test mode returns synthetic data only — not real inventory.
- Search-only results have no price; cannot be filtered by budget.
- Trip cost estimates are rough (fixed accommodation rates, no dynamic pricing).
- No booking or payment flow.
- No automated link monitoring (manual QA only via AirlineQAPanel).

## Safety Rules

See `docs/SAFETY_RULES.md`.
