# Bus o'Clock

**Know when to head out.**

Online app: https://claire0712.github.io/bus-o-clock/

The website does not require a local server. Use device location or the labelled public example. Favourites are stored separately in each browser/device.

For GitHub Pages use `npm run build:web` (project subpath). Android continues to use `npm run android:sync` (root path).

LSGI3212 location-based Android commuting assistant for Hong Kong.

## Live application and Android build

The integrated application is now `index.html` / `app.js`; `ui-preview.html` remains
an unconnected design reference. The live app uses real KMB data, device or manual
coordinates, persisted commutes and continuously refreshed departure advice.
The public Chuk Yuen example is explicitly labelled and never represents device
location. No server, API key or account is required.

Requirements: Node 22+, JDK 21, Android SDK platform 36 and accepted SDK licences.
Set JAVA_HOME to JDK 21 and ANDROID_HOME to your SDK, or configure Android Studio.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
npm run dev
npm run android:sync
cd android
./gradlew assembleDebug lintDebug
```

The installable development APK is `android/app/build/outputs/apk/debug/app-debug.apk`.
It uses a debug signing key and is for coursework/testing, not Play Store release.
Do not commit local.properties, signing keys or build caches. The Android app
requests foreground coarse/fine location only when the user chooses Use my location.
App data backup is disabled; favourites remain local. Backgrounding stops live
watchers; returning to the foreground refreshes advice.

## Finding and saving a bus

- Search official Chinese or English stop names or an exact KMB route number without giving location access. Results identify each stop; selecting a service retains its exact stop ID, direction, service type and stop sequence.
- Open the interactive map to select numbered stops, or move the map and search around its centre. Dense stops are clustered; selecting a stop highlights both its map marker and list card. If map tiles fail, the search and stop list remain usable. The default Hong Kong view is labelled and does not claim to be your location.
- Arrival rows show both minutes remaining and the expected clock time in Hong Kong, with a next-day label after midnight. The highlighted recommended bus has a short explanation based on the walking and buffer times; stale or failed ETA requests clear the recommendation.
- Edit and save two time plans, **Usual** and **Extra time**, for each commute. Switch between them on Home; both sets of values persist locally. Existing saved commutes remain compatible.
- Refresh stop data from Nearby to clear the local catalogue cache and repeat the current search. Web catalogues have a 36-hour snapshot freshness limit, and ETA always comes from KMB directly. This cannot correct errors in the upstream provider's data.

Map rendering uses [Leaflet](https://leafletjs.com/) with [MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) and standard [OpenStreetMap tiles](https://operations.osmfoundation.org/policies/tiles/), with visible attribution. Tiles require internet and are loaded only when the map is opened; no bulk or offline tile download is provided. The stop-selection map and walking-route view use the same map library. Commute walking and buffer minutes remain user-entered estimates.

## Walking to the selected stop

The main action in a map popup is **Walk to this stop**. It opens a route view inside Bus o’Clock. Choose **Route from my location**, or select a starting point on the map / enter coordinates, then calculate the route. The map draws the returned walking path and shows its estimated distance and time. **View bus services** stays a separate action for choosing the bus route and direction. Walking routes are also accessible from the selected-stop card, service page and saved commute.

Routing uses the public [FOSSGIS walking service](https://routing.openstreetmap.de/about.html) (`routed-foot`, OSRM with OpenStreetMap data). It is a route preview: no spoken directions, live position tracking or automatic rerouting. The app explains before calculation that the service receives the origin and destination and may log requests; Bus o’Clock does not store the starting point. Only explicit requests are made, at least 1.1 seconds apart, and language changes reuse the current route. Nearby tiles and routing are separate network services.

The initial scope accepts points within 30 km straight-line distance and requires road snapping within 100 m. Missing location, disconnected roads, timeout or service failure show an error; no straight line is presented as a walking route. Roads, crossings and access may differ from map data and need real-world checking. The public routing service has no availability guarantee for this project. Existing commutes without stored stop coordinates resolve the official stop ID first. Route estimates do not silently overwrite the saved walking/buffer minutes.

Search and device location remain the main Nearby entry points. Public examples, coordinate input and catalogue refresh are under **More ways to choose a stop**. Stop cards separate names from distance; technical IDs and service details are expandable.

Interface evidence and trial materials: [UI iteration notes](docs/UI-ITERATION.md), [usability trial worksheet](docs/USABILITY-TEST.md). The worksheet is unfilled; participant testing has not yet been reported.

## Interface languages

Choose a language in the header or Settings: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, French, Spanish, German or Portuguese. The choice is stored on the current browser/device. Changing language preserves the selected stop, route, saved commutes and unsaved commute-form inputs.

UI labels, validation, status messages and departure advice are translated. KMB stop names, destinations and service remarks use the official Traditional/Simplified Chinese fields for Chinese interfaces and the official English field for other interfaces. User-created commute labels remain unchanged. Translations have not yet been reviewed by native speakers of every language.

Public-review research and proposed priorities: [User needs evidence](docs/USER-NEEDS-RESEARCH.md). These are exploratory secondary sources, not interviews with Bus o'Clock users.

## Source and integration

- `app.js`, `app.css`, `index.html`: live interface, adapted from the original prototype.
- `i18n.js`, `feature-i18n.js`: nine interface languages, saved language preference and official-name fallback.
- `stop-map.js`, `journey-tools.js`: interactive stop map, clock labels, explanations and time plans.
- `navigation.js`, `walking-view.js`: validated walking-service requests and the in-app route view.
- `packages/data`: KMB client, location, departure calculations, persistence and tests.
- `android`: Capacitor native project and foreground location permissions.
- `tests/app.spec.js`: browser integration and error-state checks.
- `docs/B-INTEGRATION.md`: data-layer API contract.
- `docs/APP-VERIFICATION.md`: final integrated-app verification and known limitations.

Data attribution: [KMB / Long Win on DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb).
Third-party data remains subject to its provider's terms. No live turn-by-turn guidance, background notifications, multi-operator planning or account synchronisation is provided.

## Data integration handoff (19 November)

See [Data verification and handoff](docs/member-b/HANDOFF.md), [report section](docs/member-b/REPORT-SECTION.md), and [three-slide content with speaking notes](docs/member-b/PPT-CONTENT-AND-SCRIPT.md).

## First use and navigation

First-time users start from a welcome screen and choose **Set up my commute**. A three-step flow guides them through **Stop → Route → Timing**, then returns to Home with departure advice. **Home** is for saved commutes and countdowns; **Find stops** is for search, maps and choosing services; **Settings** contains language and app information. Commute timing is edited from Home, on its own screen. Back actions preserve the stop search and never save unfinished timing changes.
