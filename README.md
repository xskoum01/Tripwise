# Tripwise

Tripwise is a Czech travel recommendation MVP for comparing trips by value, not only by the cheapest fare. Users describe a travel wish, Tripwise parses it into structured filters, queries enabled providers, normalizes results, scores them, and explains the tradeoffs.

## Provider Architecture

The search service uses provider adapters behind `TravelSourceAdapter`. Each adapter returns a `ProviderSearchResult` with `success`, `skipped`, or `error`, so one provider cannot break the whole search. Results are normalized into `ItineraryOption`, optionally enriched with weather, deduplicated, filtered, scored, and returned with provider statuses and warnings.

Current provider modules:

- `skyscanner-live`: skeleton for Skyscanner Live Prices verified/bookable results.
- `skyscanner-indicative`: skeleton for Skyscanner Indicative Prices inspiration results.
- `duffel`: skeleton for Duffel offer search. Booking/order creation is not implemented.
- `kiwi`: skeleton for official Kiwi/Tequila API access only.
- `ryanair-deeplink`: search-link support only. It never scrapes and never verifies availability.
- `open-meteo`: best-effort weather/climate enrichment.
- `mock`: explicit demo provider, disabled by default.

## Environment Variables

Create `.env.local` as needed:

```bash
SKYSCANNER_API_KEY=
SKYSCANNER_MARKET=CZ
SKYSCANNER_LOCALE=cs-CZ
SKYSCANNER_CURRENCY=CZK

DUFFEL_ACCESS_TOKEN=
KIWI_API_KEY=

ENABLE_MOCK_PROVIDER=false
OPEN_METEO_ENABLED=true
```

API keys are read only on the server and are never exposed to client components.

## Provider Status

Check enabled/configured providers:

```bash
curl http://localhost:3000/api/providers/status
```

The endpoint explains which providers are enabled, which are missing credentials, and why mock data is or is not available.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without API keys and with `ENABLE_MOCK_PROVIDER=false`, Tripwise will run normally but return no fake travel offers. The UI will show provider warnings/statuses instead of pretending demo results are real.

To run with explicit demo data:

```bash
ENABLE_MOCK_PROVIDER=true npm run dev
```

On Windows PowerShell:

```powershell
$env:ENABLE_MOCK_PROVIDER="true"; npm run dev
```

## Adding Providers

To add Skyscanner, set `SKYSCANNER_API_KEY`. The current adapters intentionally skip until the exact Live Prices and Indicative Prices API contracts are completed and tested.

To add Duffel, set `DUFFEL_ACCESS_TOKEN`. The adapter is prepared for offer search, but booking is not implemented. Before booking in the future, a selected offer must be re-fetched because offers can become stale.

To add Kiwi, set `KIWI_API_KEY`. Tripwise should use only official API responses and must not rely on unofficial scraping.

## Why Ryanair Scraping Is Not Implemented

Tripwise does not scrape Ryanair. Ryanair support is limited to generated search/deep links or future authorized provider results. Generated Ryanair links are marked as `search`, not verified offers, because the provider may still show no flight or changed prices for the selected date.

## Result Statuses

- `verified`: live/provider-confirmed result, suitable for an exact offer link.
- `indicative`: cached or inspiration price, not a guaranteed bookable offer.
- `search`: opens a provider search page; availability must be checked by the user.
- `fallback`: generic provider/source link when no route/date link can be built.
- `mock`: explicit demo data, never real availability.

Price statuses:

- `live`: current provider price.
- `cached`: provider cached/indicative price.
- `estimated`: demo or estimated price.
- `unknown`: no reliable price.

## Current Limitations

- No scraping.
- No booking, payment, authentication, or database.
- Real provider adapters are conservative skeletons until API contracts and credentials are available.
- Mock results are disabled by default and shown only as demo data.
