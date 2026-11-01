# Bus o'Clock

**Know when to head out.**

LSGI3212 Mobile GIS and Location-Based Services | Group 6 | Progress update: 1 November 2026

## App idea

Bus o'Clock is an Android commuting assistant under development for Hong Kong students and regular commuters. It combines bus arrival estimates with user-entered walking and buffer times to suggest when to leave for a bus stop. The initial scope uses KMB/LWB open data.

## Planned core functions

- Find nearby stops using device location and a map/list interface.
- Select a stop, route and direction and view estimated arrivals.
- Calculate departure advice: arrival time minus walking time minus buffer.
- Save common commutes and personal time settings.
- Show data freshness and explain unavailable or outdated estimates.

Walking time is entered by the user; straight-line distance is not walking time. Advice is an estimate, not a guarantee of catching a bus.

## Work completed and evidence

- The concept, initial scope and page flow have been defined.
- Member A prepared a clickable browser UI prototype with mock data and page handoff notes. The local prototype is not yet uploaded or connected to live services.
- Member B implemented the data module on [feat/data-location](https://github.com/Claire0712/bus-o-clock/tree/feat/data-location), covering API retrieval, nearby-stop logic, arrival processing, departure calculations, location adapters and local favourites.
- [B's verification record](https://github.com/Claire0712/bus-o-clock/blob/feat/data-location/docs/B-VERIFICATION.md) reports 29 passing tests, a successful live KMB API check and browser checks of saved-commute persistence. Real-device permissions have not yet been verified.

**This is an initial progress submission, not a complete Android app. No APK is currently available.** The data module is on a separate branch and has not been merged into main. The feat/ui branch exists, but the UI files are still pending upload.

## A/B contributions

- **A:** page layouts, interactive UI prototype and interface handoff notes.
- **B:** data structures, API access, nearby-stop logic, departure calculations, favourites and data-module tests.

These labels describe the current development workstreams, not the full five-member contribution roster.

## Next steps

Upload the UI, connect it to [B's documented interface](https://github.com/Claire0712/bus-o-clock/blob/feat/data-location/docs/B-INTEGRATION.md), and test the full stop-to-departure flow. Refine the screens and error states, confirm the app framework, test Android location permissions and lifecycle behaviour, and produce an APK.

## Current challenges and limitations

ETA predictions may change, be missing or become stale. User-entered walking times may not reflect crossings or station access. UI and data compatibility is not yet verified. Current browser tests do not establish Android device behaviour. Automatic walking routes, multi-operator journey planning and background notifications are outside the initial scope.

## Data source

[Official KMB/LWB route, stop and ETA data — DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)

Third-party data remains subject to the provider's terms and attribution requirements. The diagnostic page in B's branch is for data verification, not the final product UI.
