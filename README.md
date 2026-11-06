# Bus o'Clock

**Know when to head out.**

Bus o'Clock is a location-based commuting assistant being developed for Hong Kong. It combines real-time bus arrival estimates with your walking time and a configurable buffer to suggest when to leave for your stop.
LSGI3212 Mobile GIS and Location-Based Services | Group 6 | Progress submission: 1 November 2026

## App idea
Bus o'Clock is an Android commuting assistant under development for Hong Kong students and regular commuters. It combines bus arrival estimates with user-entered walking and buffer times to suggest when to leave for a bus stop. The initial scope uses KMB/LWB open data.

## Planned core functions
- Find nearby stops using device location and a map/list interface.
- Select a stop, route and direction and view estimated arrivals.
- Suggest a departure time: estimated arrival time minus walking time minus buffer.
- Save common commutes and personal time settings.
- Show data freshness and explain unavailable or outdated estimates.

Walking time is entered by the user; straight-line distance is not walking time. Departure advice is an estimate, not a guarantee of catching a bus.

## Work completed
- Defined the concept, initial feature scope and page flow.
- Uploaded a [clickable UI prototype](ui-preview.html) and [interface proposal](UI-PROPOSAL.md) to the main branch. The prototype covers home, departure details, nearby stops, service selection and commute settings, with selected error-state examples.
- Implemented the [data module](https://github.com/Claire0712/bus-o-clock/tree/feat/data-location) on a separate development branch, covering API retrieval, nearby-stop sorting, arrival processing, departure calculations, location adapters and local favourites.
- The [verification record](https://github.com/Claire0712/bus-o-clock/blob/feat/data-location/docs/B-VERIFICATION.md) reports 29 passing tests, a successful live KMB API check and browser checks of saved-commute persistence. Real-device Android permissions remain unverified.

## Review the prototype
Download [ui-preview.html](ui-preview.html) and open it in a browser. No installation or build command is needed. GitHub shows the source file rather than running the interface.

The prototype uses mock stops, routes, times and a schematic map. Settings can be edited for demonstration, but countdown examples stay fixed. It does not request GPS, load live ETA data or persist favourites. The data module has not yet been connected to this interface.

**This repository documents initial project progress. An integrated Android app and APK are not yet available.** UI files are in main; the data module remains on feat/data-location pending integration.

## Next steps
Connect the interface to the [documented data contract](https://github.com/Claire0712/bus-o-clock/blob/feat/data-location/docs/B-INTEGRATION.md), starting with one real stop and service. Test the complete stop-to-departure flow, refine layouts and error states, confirm the app framework, test Android location permissions and lifecycle behaviour, and produce an APK.

The framework-independent data layer is implemented in `packages/data`: live KMB arrivals, nearby stops, location adapters, departure advice and local favourites. The main app UI and Android packaging are pending integration.

See [member B's integration guide](docs/B-INTEGRATION.md) for the API contract, React lifecycle example and Android requirements.

### Verify the data layer

Requires Node.js 22 or newer. No dependency installation is needed for these checks.

```sh
node --test packages/data/test/*.test.js
node packages/data/scripts/live-smoke.js
```

The first command runs deterministic tests. The second makes real requests to KMB and needs network access.

### Browser integration check

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/packages/data/examples/diagnostic.html` and choose **Load example location**. This uses a clearly labelled public example location and real arrival data, without requesting your device location. This diagnostic page is not the final product UI.
## Current challenges and limitations
Arrival estimates may change, be missing or become stale. User-entered walking times may not reflect crossings or station access. UI–data compatibility is not yet verified, and browser checks do not establish Android device behaviour. Automatic walking routes, multi-operator journey planning and background notifications are outside the initial scope.

## Data source
[Official KMB/LWB route, stop and ETA data — DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)

Third-party data remains subject to the provider's terms and attribution requirements. The diagnostic page in the data branch is for verification, not the final product UI.
