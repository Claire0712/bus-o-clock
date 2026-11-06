# Frontend and Android integration plan

Goal: connect the existing Bus o'Clock interface to real data and deliver a tested Android debug APK and source on GitHub.

Architecture: retain the prototype styling and page flow; add a live ES-module entrypoint consuming packages/data. Capacitor wraps built web assets with native geolocation. No secrets or hosted backend are required.

- [x] Add a live entrypoint with nearby location/manual coordinates, stop and service selection, settings, saved commute and live advice.
- [x] Stop requests/watchers on navigation and background; resume live advice in foreground.
- [x] Test browser flow, persistence, denied location, failed requests, stale/missing data and small-screen layout.
- [x] Configure Capacitor Android, permissions and reproducible build scripts.
- [x] Build APK, install on emulator, test launch/navigation/location/persistence and inspect crashes.
- [ ] Update README and verification record; upload source and APK deliverable to GitHub.

The existing ui-preview.html stays as design reference. The live app must never display its mock ETA or schematic user position as real information.
