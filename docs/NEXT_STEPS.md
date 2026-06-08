# Tripwise — Next Steps

## P0 — Immediate / Blocking

### QA: Test airline search links
- Go through AirlineQAPanel in dev mode.
- Mark each link as `manual-ok` or `manual-broken`.
- Fix or remove broken links in `airlineLinks.ts`.
- Priority: Ryanair, Wizz Air, easyJet, Vueling.

### Test Ryanair unofficial results end-to-end
- Enable `ENABLE_RYANAIR_UNOFFICIAL_PROVIDER=true` in `.env.local`.
- Run test queries (sea, July, from PRG/VIE).
- Verify: prices parse correctly, links open correct Ryanair search, not blocked.
- Document known failure modes (geo-blocking, CAPTCHA, schema changes).

---

## P1 — Important / Near-term

### Improve Wizz/easyJet/Vueling search links after QA
- After QA pass, update URL templates in `airlineLinks.ts` for any broken links.
- Validate: date format, origin/dest IATA codes, passenger count params.

### Better result sorting UI
- Currently sort is fixed (score-based with price tiebreak).
- Add sort toggle in UI: Best match / Cheapest / Best weather / Most comfortable.
- No new backend work — just expose `byPrice`, `byComfort` sort variants.

### Export/import saved searches
- Add JSON export button to `SavedSearches` component.
- Add JSON import (file picker or paste).
- Format: array of `{ wish, parsedRequest, savedAt }`.

---

## P2 — Future Research

### Wizz Air unofficial research provider
- Similar approach to ryanair-unofficial.
- Research Wizz public endpoints — check terms, stability, rate limits.
- Only implement if endpoint is stable and personal/non-commercial use is acceptable.

### Travelpayouts/Aviasales cached provider
- Affiliate API with cached prices — needs API key.
- Could give broader destination coverage (CZ/SK origins).
- Research: Travelpayouts affiliate program terms, data freshness, CZK support.

### Scheduled rerun / notifications
- Use `BatchRunPanel` + browser notifications or email.
- Trigger: manual button or scheduled interval.
- Alert when: new results appear below budget, price drops.
- Needs backend persistence (currently localStorage only).

---

## Notes

- Do not add P2 items without validating P0/P1 first.
- Each provider addition requires a safety review (see `SAFETY_RULES.md`).
- Budget semantics (`budgetType`) are now implemented — test all three cases before shipping any budget-related changes.
