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

## Revalidation — 6 November 2026

Merged current `origin/main` into the data branch, retaining the UI prototype and
both the project progress description and data verification instructions.
GitHub reported PR #1 as mergeable after the merge was pushed.

- Deterministic suite: 29 passed, 0 failed after the merge.
- Live KMB smoke check at 17:39 Hong Kong time: 6,771 stops, five nearby
  stops, one boardable service at the example stop, five raw ETA rows,
  three retained departures, advice status `wait`.
- This check used public example coordinates, not device location.

### Requirements evidence and outstanding dependency

The local course introduction specifies a group project demonstration and an
individual report including source and dataset where applicable. The local
`Instruction for Literature Review.pdf` concerns analysis of an existing app;
it is not a development-project rubric. No detailed development-project rubric
was found in the course workspace. Compliance with an unseen rubric is therefore
not claimed.

The available repository scope maps to these implementation and test files:

| Repository requirement | Implementation | Behavioural coverage |
| --- | --- | --- |
| Nearby stops and device/manual location | `src/location.js`, `src/commute.js` | Radius/order, invalid points, permission denial, manual point |
| Live service and ETA retrieval | `src/kmb.js` | Full service identity, terminal exclusion, failures, timeout |
| Walking time and buffer departure advice | `src/departures.js` | Next catchable bus, midnight, stale data, null ETA, invalid durations |
| Saved commutes | `src/favourites.js` | Persistence, identity, corrupt storage and quota failure |
| Refresh and freshness | `src/commute.js` | Refresh failure/recovery, disposal, stale data while request stalls |

Paths in the table are relative to `packages/data`; corresponding tests are in
`packages/data/test`. This is a client-consumable data/business-logic package,
not a deployed HTTP server. The documented project architecture uses direct KMB
requests and local storage. No requirement for accounts, a server database or a
hosted backend has been established.

The data package and handoff are uploaded in PR #1. UI integration, Android
packaging and physical-device validation remain outstanding application work.
The detailed project brief is needed to confirm any additional backend deliverables.

## Project brief found and cancellation regression fixed

The authoritative local brief is `Assignment_Project/Instruction of Group Project2026.pdf`
in the course workspace (LSGI3212 Group Project 2026/27). This supersedes the earlier
missing-brief note above. It requires a functional Android LBS app, source + APK ZIP,
contribution list, presentation and group PDF report, due 23 November 2026 at 08:30
Hong Kong time. It does not mandate a hosted server or database.

The data-layer scope remains KMB access, location, nearby search, departure advice
and local favourites. Android integration and APK validation remain necessary for
the whole application; module tests alone do not satisfy that requirement.

Added regression tests for cancellation before nearby search and cancellation while
waiting for device location. Both failed before the fix; the full suite now passes
31 tests. Cancellation rejects promptly with ABORTED and late location results do
not start a catalogue request. The OS permission dialog itself cannot be dismissed
by this module. No physical-device validation is claimed.

### Catalogue recovery and continuous checks

Added malformed-coordinate regression coverage (blank, nonnumeric and out-of-range
latitude). The test failed before the fix. Invalid stop catalogues now report
INVALID_RESPONSE and are evicted from the cache so retry can retrieve corrected
data. The complete deterministic suite passes 32 tests locally.

`.github/workflows/data-tests.yml` runs the dependency-free test suite under Node 22
on data-layer pushes and pull requests. Live KMB checks remain opt-in to avoid making
operator availability a prerequisite for deterministic checks.
