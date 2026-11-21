> The live implementation is now `index.html` / `app.js`; see README for running and Android packaging. This document describes the original mock prototype.

# Interface prototype and integration plan

## Current status
A framework-neutral HTML/CSS/JavaScript prototype is available in [ui-preview.html](ui-preview.html). Download the file and open it in a browser; no installation or build is required. GitHub displays its source, not the running interface.

This prototype uses sample content and a schematic map. It does not request GPS, retrieve live arrivals or persist favourites. Countdown examples remain fixed even when settings are edited. It is not the final Android application.

## Pages and flow
1. Home: saved commute summary and departure advice; an empty state for new users.
2. Departure details: arrival estimates, walking and buffer times, refresh and edit actions.
3. Nearby stops: schematic map, search and stop selection, with distances labelled as straight-line.
4. Service selection: stop, route and direction, then confirmation.
5. Commute settings: walking minutes, buffer minutes and preview-save feedback.

Flow: nearby stops → stop → service/direction → settings → home → departure details.

Illustrative states cover no arrival estimate, location permission, insufficient planned time and no saved commute. These are UI examples, not proof of working location or ETA services.

## Integration
Use the existing [data-module integration guide](https://github.com/Claire0712/bus-o-clock/blob/feat/data-location/docs/B-INTEGRATION.md). Preserve the full service identity, including direction, service type and stop sequence. Render returned departure states instead of duplicating calculation logic.

The UI work covers layouts, controls and feedback. The data work covers service access, location, sorting, storage and calculations. Confirm the app framework and shared entry point before integration. Begin with one real stop/service, then extend to loading, stale, missing and failed responses.

## Remaining checks
- Connect UI actions to real services and persistent favourites.
- Check long stop names, phone layouts, keyboard controls and touch targets.
- Show freshness and retry options without presenting old estimates as current.
- Validate permissions, lifecycle and saved settings on Android.
- Produce an APK after integration and device testing.
