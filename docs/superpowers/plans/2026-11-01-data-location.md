# Bus o'Clock data and location implementation plan

**Goal:** Deliver member B's browser-compatible data layer and a documented integration contract for member A.

**Architecture:** A dependency-free ES module package in `packages/data` owns KMB requests, location adapters, departure calculations and local favourites. A owns UI and the root application toolchain. Store route direction, service type and stop sequence explicitly. Never infer walking time from straight-line distance.

**Tech stack:** JavaScript ES modules, browser Fetch/Geolocation/Storage APIs, Node 22 built-in tests. Optional injected Capacitor Geolocation adapter for Android.

## Execution

- [ ] Write behavioural tests before implementation; run `node --test packages/data/test/*.test.js` and confirm expected failures.
- [ ] Implement `src/departures.js`: filter direction/service/sequence, reject old or invalid timestamps, select next catchable service using configured walking time and buffer. Preserve operator remarks and scheduled-service labels.
- [ ] Implement `src/location.js`: Haversine distances in metres, bounded nearby sorting, browser permission failures, optional Capacitor provider. Manual location remains an A UI choice.
- [ ] Implement `src/kmb.js`: stops, route list, route-stop associations, ETA. Cache static catalogues, bound network requests, surface explicit errors, support cancellation.
- [ ] Implement `src/favourites.js`: validated versioned localStorage records, deterministic identity including sequence, update/delete, corrupt/unavailable storage states.
- [ ] Implement `src/commute.js`: integration facade and disposable foreground watcher. Recompute freshness/countdowns every second; refresh ETA every minute; clear advice on request failures.
- [ ] Run deterministic tests and an opt-in live KMB smoke test. Document counts/status without storing user location.
- [ ] Deliver `index.d.ts`, `docs/B-INTEGRATION.md` and a diagnostic page using real data. Confirm browser imports work.
- [ ] Commit and push the feature branch; open a reviewable PR for A. APK build requires A's frontend entrypoint and chosen wrapper; document actual remaining integration steps without claiming a built APK.

## Verification cases

Tests must cover mixed directions, repeated stops, different service types, missing/null ETA, stale row vs fresh envelope, clock skew, all departures too soon, cross-midnight ISO timestamps, invalid durations, straight-line radius ordering, denied location, malformed storage, storage quota failures, upstream HTTP/JSON errors and cancellation.

## Scope and handoff

No UI framework or root package configuration is selected on A's behalf. Android SDK and Android Studio are installed locally, but there is no UI or Android application in the repository yet. Source requests use official KMB APIs; a successful HTTP response is not proof that every ETA is fresh.
