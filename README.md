# Tripwise

Tripwise is a personal trip candidate finder for Czech travelers. It parses a natural-language wish into structured filters, queries enabled providers, normalizes results, scores them, and explains the tradeoffs.

## Strategy

Tripwise is primarily built for **personal low-cost trip hunting**, not as a commercial booking platform.

- It does not guarantee final prices. Every result must be verified directly at the source before purchase.
- Unofficial low-cost providers (Ryanair unofficial) are **personal-use only** and disabled by default. They discover fares using public endpoints — not verified bookable offers.
- Duffel **test mode** (token prefix `duffel_test_`) returns sandbox data only. These results are not real flights and are excluded from primary recommendations by default (`SHOW_DUFFEL_TEST_RESULTS=false`). Use test mode for API integration development only.
- Duffel **live mode** (token prefix `duffel_live_`) returns real verified offers.
- No scraping, no browser automation, no CAPTCHA bypass, no booking or payment flow is implemented anywhere.

## Provider Architecture

The search service uses provider adapters behind `TravelSourceAdapter`. Each adapter returns a `ProviderSearchResult` with `success`, `skipped`, or `error`, so one provider cannot break the whole search. Results are normalized into `ItineraryOption`, optionally enriched with weather, deduplicated, filtered, scored, and returned with provider statuses and warnings.

Provider priority (personal low-cost use case first):

1. **`ryanair-unofficial`** — personal-use only, disabled by default. Uses Ryanair's public fare-finder endpoint to discover round-trip fares over a date range. Results are always `search` / `estimated` — never `verified`. Always shows "Neoficiální zdroj" badge. Enable with `ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true`.
2. **`ryanair-deeplink`** — search-link support only. Never scrapes, never verifies availability.
3. **`kiwi`** — skeleton for official Kiwi/Tequila API. Only official API responses; no scraping.
4. **`skyscanner-live`** — skeleton for Skyscanner Live Prices verified/bookable results.
5. **`skyscanner-indicative`** — skeleton for Skyscanner Indicative Prices inspiration results.
6. **`duffel` (live)** — Duffel offer search with live verified results. Token prefix `duffel_live_`. Booking/order creation is not implemented.
7. **`duffel` (test)** — Sandbox data only. Token prefix `duffel_test_`. Excluded from primary recommendations by default. Use for API integration development.
8. **`open-meteo`** — best-effort weather/climate enrichment.
9. **`mock`** — explicit demo provider, disabled by default.

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

# Unofficial Ryanair fare finder — personal use only, disabled by default.
# Results are never verified. Always shown with "Neoficiální zdroj" badge.
ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=false
ALLOW_UNOFFICIAL_PROVIDERS_IN_PRODUCTION=false

# Duffel test mode control.
# When DUFFEL_ACCESS_TOKEN starts with 'duffel_test_', results are sandbox data.
# Set to true only for integration development — sandbox results are not real offers.
SHOW_DUFFEL_TEST_RESULTS=false
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

## Ryanair Unofficial Provider

`ryanair-unofficial` is a personal-use adapter that calls Ryanair's public fare-finder JSON endpoint (the same endpoint their website uses). It is **disabled by default** and must be opted in explicitly.

Rules that always apply:

- Results are always `availabilityStatus: "search"` and `priceStatus: "estimated"` — never `verified`.
- The UI always shows "Neoficiální zdroj" badge and a warning that availability and final price must be verified directly with Ryanair.
- No browser automation, no CAPTCHA bypass, no DOM scraping.
- No booking or payment flow is implemented.
- Disabled in production unless `ALLOW_UNOFFICIAL_PROVIDERS_IN_PRODUCTION=true` is also set.

To enable for local personal use:

```bash
ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true
```

## Why Ryanair Verified Results Are Not Implemented

Tripwise does not have access to Ryanair's official partner API. The `ryanair-deeplink` adapter generates search links only. The `ryanair-unofficial` adapter is a personal-use fallback using the public fare-finder endpoint, not an official integration.

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

## Configuration & Troubleshooting

### Adding Kiwi/Tequila API Key

Tripwise supports multiple environment variable names for backward compatibility:

- `KIWI_API_KEY` (recommended, current)
- `TEQUILA_API_KEY` (alternative)
- `KIWI_TEQUILA_API_KEY` (legacy)

Add your key to `.env.local`:

```bash
KIWI_API_KEY=your-actual-key-here
```

**Important:** After modifying `.env.local`, restart the dev server:

```bash
# Stop the running dev server (Ctrl+C)
npm run dev
```

The environment is read once at startup. Changes to `.env.local` require a restart to take effect.

### Verifying Provider Configuration

Check which providers are configured and active:

```bash
curl http://localhost:3000/api/providers/status
```

In development mode, the Kiwi provider status includes:

```json
{
  "name": "kiwi",
  "configured": true,
  "enabled": true,
  "message": "Kiwi/Tequila key configured via KIWI_API_KEY; live search enabled.",
  "diagnostics": {
    "keyLength": 32,
    "envVarName": "KIWI_API_KEY"
  }
}
```

The `diagnostics` field (development only) shows which environment variable is being used and the key length, but never exposes the actual secret.

### Kiwi Not Configured

If Kiwi shows "not configured" but you've added a key to `.env.local`:

1. Ensure the key is in one of the supported variable names (see above)
2. Restart the dev server
3. Verify `.env.local` is readable and has no syntax errors
4. Verify the key is not empty (not just `KIWI_API_KEY=`)

### Troubleshooting: "Nic jsme nenašli" + providers not configured

If the UI shows "Nic jsme nenašli" and provider details indicate all real providers are not configured:

1. Add at least one real provider key to `.env.local`:
  - `KIWI_API_KEY` or `TEQUILA_API_KEY`
  - `SKYSCANNER_API_KEY`
  - `DUFFEL_ACCESS_TOKEN`
2. Or enable demo mode for UI testing: `ENABLE_MOCK_PROVIDER=true`
3. Restart dev server after `.env.local` changes: `npm run dev`
4. Check provider status at `/api/providers/status`

## Future Provider Backlog

The following providers are on the personal-use backlog. None are implemented yet. Scraping, browser automation, or CAPTCHA bypass will never be used.

- **Wizz Air personal provider** — Wizz Air exposes a public availability/pricing JSON endpoint similar to Ryanair's fare-finder. A personal-use adapter following the same pattern as `ryanair-unofficial` could be added. Always personal-use only, never verified.
- **Smartwings search/manual verification** — Smartwings does not have a documented public API. A deep-link / manual-verification approach (similar to `ryanair-deeplink`) would be the only ethical option.
- **Google Flights verification link** — A helper that builds a Google Flights search URL for a given route/date could be used as a verification shortcut for the user, not as a data source.
- **Skyscanner manual verification link** — Similar to Google Flights, a Skyscanner search URL builder for user-side verification. Distinct from the official Skyscanner API adapter.

## Current Limitations

- No scraping, no browser automation, no CAPTCHA bypass.
- No booking, payment, authentication, or database.
- Real provider adapters are conservative skeletons until API contracts and credentials are available.
- Mock results are disabled by default and shown only as demo data.
- Duffel test mode results are excluded from primary recommendations by default.
