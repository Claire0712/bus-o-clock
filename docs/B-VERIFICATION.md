# Member B verification

Verified on 1 November 2026 (Hong Kong time).

## Automated

- `node --test packages/data/test/*.test.js`: 29 tests passed, 0 failed.
- `npx --yes --package typescript tsc --noEmit --strict --lib ES2022,DOM packages/data/index.d.ts`: passed.
- Read-only code review: no important actionable findings.
- Node 22 emits an experimental warning for its test-only MockTimers API. The application does not use that API.

## Real KMB API

`node packages/data/scripts/live-smoke.js` succeeded at 21:42 Hong Kong time:

- 6,774 stops loaded.
- Chuk Yuen Estate Bus Terminus (WT916), stop `18492910339410B1`.
- Route 1 outbound, service type 1, stop sequence 1.
- One boardable service choice at this stop; the inbound terminating service was excluded.
- Five raw ETA rows returned; two relevant future departures retained.
- Advice status `wait`. API-generated and row timestamps both passed freshness checks.

Observed collection endpoints without a trailing slash can return HTTP 403 in this environment. The verified working collection URLs `/route/` and `/route-stop/` are used. No API key, proxy or disabled TLS verification is needed.

## Browser

In-app browser against the localhost diagnostic page:

- Loaded example coordinates explicitly labelled as a public example, not user location.
- Fetched and sorted nearby stops over direct browser CORS requests.
- Displayed the boardable route 1 outbound option and real departure advice.
- Preserved the operator's `Scheduled Bus` label.
- Saved a test commute and reloaded the page: saved count remained 1.

No actual device location was requested during browser verification. Browser/native location success, rejection and approximate precision paths are covered with injected adapters in automated tests; real-device permission flows are not yet tested.

## Remaining integration

- A must connect the module to the product UI and choose the frontend build output.
- B can then configure Android packaging, perform a real-device location test, and produce the APK.
- There is currently no final app UI or APK in this branch. The diagnostic page is only a data integration check.
