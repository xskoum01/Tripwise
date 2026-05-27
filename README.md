# Tripwise

Tripwise is an AI-like travel recommendation MVP for finding the best trip by price/performance, not just the cheapest flight. Users describe a flexible travel wish in Czech, adjust a few structured filters, and receive a small ranked set of explainable recommendations.

## MVP scope

- Natural language travel wish input
- Simple Czech parser for budget, origins, trip length, sea/weekend/direct preferences
- Structured filters for origins, budget, nights, baggage, direct flights, and early departures
- Mock travel source adapter with deterministic recommendation scoring
- Highlighted best option, category winners, comparison table, explanations, warnings, and source links
- Saved/search history UI placeholder without persistence

## Tech stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Local mock data and service modules

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current limitations

- No real booking, payment, authentication, or database
- No scraping
- Search results come from local mock adapters
- Parser is intentionally simple and deterministic

## Future integration plan

Tripwise is structured around source adapters. The UI calls only the local search API and search service; future official integrations can implement the same adapter interface:

- `SkyscannerAdapter`
- `KiwiAdapter`
- `DuffelAdapter`
- `AmadeusAdapter`
- `RyanairOfficialAdapter`

The next production step is to add official API credentials, normalize provider responses into `ItineraryOption`, add caching/rate-limit handling, and keep provider-specific logic out of UI components.
