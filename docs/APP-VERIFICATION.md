# Integrated app verification — 6 November 2026

## Scope

The live application retains the prototype's styling and page flow, and connects
nearby stops, route/direction selection, commute settings, local favourites and
live departure advice to `packages/data`. Capacitor supplies Android packaging
and native foreground geolocation. The original `ui-preview.html` remains a mock
reference, not the application entrypoint.

## Automated and browser checks

- 33 deterministic data-layer tests pass, including cancellation during location,
  invalid catalogue recovery and a native plugin that never settles.
- Three Playwright integration tests pass: service selection/save/reload/delete and
  refresh failure; denied location/manual-input validation; stale/missing ETA.
- Production Vite build succeeds. npm dependency audit reports zero vulnerabilities
  at installation time.
- A real browser request through the final interface selected Chuk Yuen Estate's
  route 1 service and displayed live advice, timestamps and Scheduled Bus labels.
  `evidence/browser-live.png` records the observed page, using public example
  coordinates rather than a person's location.

## Android checks

Build command: JDK 21, Android SDK 36, `./gradlew assembleDebug lintDebug`.
The initial build succeeded. Lint has no errors; template warnings include dependency
updates, generated unused resources/icons and compile SDK compatibility guidance.
Final APK/emulator results and checksum are recorded with the release.

An earlier native run successfully installed, launched and completed the real
stop/service/save/advice flow. Its emulator System UI later became unresponsive;
that run does not establish location success. A separate JavaScript timeout now
bounds native position acquisition even if the plugin never settles. Native
permission prompts still require the user's response.

## Boundaries

This is a debug-signed coursework build, not a production store release. Emulator
location is simulated; it is not a physical-device GPS accuracy test. Android
permission and location behaviour should also be checked on the group's target
phone before the presentation. No background tracking, automatic walking routes,
account sync or full map renderer is implemented. Nearby distances are explicitly
straight-line, with device accuracy shown when available.

The source/APK delivery is only the software part of the assignment. Group member
names/contributions, presentation and written report must reflect actual group work;
they are not fabricated by this implementation.

## Final integration results

- Android debug APK installed and launched on the API 36 emulator.
- Real KMB stop/service selection, saving and live departure advice worked in the
  installed WebView, with no mock API interception.
- Saved commute survived force-stop/relaunch and an APK update.
- After completing the emulator's Google Location Accuracy setup, native
  geolocation returned the injected public Hong Kong coordinates with 5 m reported
  accuracy and 20 stops within 1 km. This validates the native bridge, not GPS hardware.
- Native acquisition timeout was observed and correctly exposed as LOCATION_TIMEOUT
  with manual-coordinate fallback. Browser permission-denial handling is covered
  by the integration test; a physical handset's permission UI is not certified.
- Android system-bar margins are enabled to avoid edge-to-edge overlap. The final
  screenshot is `evidence/android-live.png`.

Final local APK SHA-256:
`76fafcea0b7efed835ca84455a5a6cb01a5dce5c2d1ac3803e22bcc88e4e0fe2`.
The final APK was reinstalled; its saved commute and live advice were rechecked,
and the system-bar layout screenshot was reviewed after the margin fix.
