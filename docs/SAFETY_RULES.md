# Tripwise — Safety Rules

These rules apply to all current and future development. Do not add features that violate them.

## Data integrity

**Never mark unofficial or search-only results as verified.**
- `availabilityStatus: "verified"` is reserved for official API responses with confirmed availability.
- Unofficial sources (ryanair-unofficial) must use `availabilityStatus: "indicative"` or `"search"`.
- Search-only results must use `availabilityStatus: "search"` and `sourceConfidence: "search-only"`.

**All prices and availability must be verified at source.**
- Tripwise shows estimates and links — it is not an authoritative booking system.
- Every result must have a `sourceUrl` pointing to the authoritative source.
- Never display a price as confirmed unless it comes from a verified API response.

**Duffel test mode is sandbox, not real bookable inventory.**
- Duffel test tokens return synthetic offers. Mark with `isSandbox: true`.
- Sandbox results must be visually separated from real results (orange section, warning label).
- Never show sandbox results alongside real results without a clear disclaimer.

## Scraping and unofficial access

**No CAPTCHA bypass, login bypass, or anti-bot evasion.**
- Unofficial providers (ryanair-unofficial) may only access publicly reachable endpoints.
- No browser automation (Puppeteer, Playwright) for production data fetching.
- No headless scraping of login-gated content.

**No use of private cookies, session tokens, or credentials that belong to a user account.**
- The app may not store or replay authentication material from airline accounts.
- Deep links are pre-built search URLs — they do not carry session state.

**Rate limiting: respect provider limits.**
- Add delays or limits when unofficial endpoints impose rate limits.
- If an endpoint returns 429/403/CAPTCHA, disable the provider rather than retry aggressively.

## Booking and payments

**No booking or payment implementation unless explicitly requested.**
- Tripwise opens search or offer links — the user books directly at the airline or GDS.
- Do not add payment form, card input, PNR creation, or ticketing logic.

## New provider checklist

Before adding any new provider:
1. Is the endpoint public and accessible without authentication credentials you don't own?
2. Is the data fresh enough to be useful? (Cached > 24h is misleading without a staleness label.)
3. Does adding this provider violate the airline's or aggregator's ToS in a way that creates legal risk?
4. Is the provider type correctly classified (official / unofficial / search-only / sandbox)?
5. Are prices labeled with the correct `priceStatus` and `sourceConfidence`?
