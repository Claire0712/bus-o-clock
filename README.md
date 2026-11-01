# Bus o'Clock

**Know when to head out.**

Bus o'Clock is a location-based commuting assistant being developed for Hong Kong. It combines real-time bus arrival estimates with your walking time and a configurable buffer to suggest when to leave for your stop.

## Planned MVP

- Find nearby KMB bus stops using device location.
- Save a stop, route, direction, and personal walking time.
- View live arrival estimates and a suggested departure countdown.
- Show the next service when the first is too soon to catch.
- Display data freshness and handle unavailable arrival estimates.

Suggested departure time = estimated bus arrival time - walking time - buffer.

Arrival times are estimates, not a guarantee. Walking time is user-configured in the initial version.

## Open data

[KMB / Long Win real-time arrival data on DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)

Third-party data remains subject to its provider's terms and attribution requirements.

## Status

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

Developed as an LSGI3212 Mobile GIS and Location-Based Services group project.
