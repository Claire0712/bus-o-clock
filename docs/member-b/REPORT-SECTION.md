# Member B — data integration and departure advice

Suggested report section. Integrate with the group's report rather than submitting
this as a separate report. Use the actual member name and contribution allocation.

## Data source and service identity

Bus o'Clock uses KMB/Long Win open data to retrieve stop locations, route metadata,
route–stop associations and estimated arrival times. The client combines these
catalogues to present boarding services at a selected stop. A service is identified
by stop ID, route, direction, service type and stop sequence. Retaining all five
fields prevents opposite directions, special services or repeated visits to a stop
from being mixed together. Terminal-only arrivals are excluded from boarding choices.

The application accesses the public API directly; it does not require a private
server, API key or user account. Static catalogues are cached in memory for one hour,
while ETA responses are requested without application caching. Favourite commutes
are validated and stored locally. They are not synchronised between browsers or devices.

## Departure calculation

The suggested departure time is calculated as:

**Suggested departure time = estimated bus arrival time − user-entered walking time − buffer time.**

For example, if a bus is expected in 10 minutes, with a 4-minute walk and a
2-minute buffer, the suggested departure countdown is 4 minutes. The application
sorts valid future arrivals and selects the first service whose suggested departure
time has not passed. If the first bus arrives in 3 minutes but the next arrives in
14 minutes, the first is too soon for the planned 6-minute allowance; the advice
uses the next bus and shows 8 minutes until departure. This is advice based on
estimates, not a guarantee of catching the bus.

Walking time is entered by the user. Nearby-stop distance is calculated using the
Haversine formula and labelled as straight-line distance; it is not converted into
walking time. Street crossings, entrances and pedestrian routes may make the actual
walk longer.

## Freshness, errors and lifecycle

Both the response generation timestamp and the timestamps of relevant arrival rows
are checked. The project suppresses advice when data is older than 120 seconds or
more than 60 seconds ahead of the device clock. These thresholds are application
policies, not operator accuracy guarantees. Operator remarks and scheduled-service
labels are preserved. Missing ETA does not automatically mean that the service has
stopped operating.

The foreground watcher recomputes countdowns every second and requests new ETA data
60 seconds after the preceding request completes. Failed requests clear the previous
advice. Watchers stop when the app is hidden and restart when it returns to the
foreground. Cancellation prevents late location results from starting obsolete
catalogue requests. Native position acquisition has a separate timeout fallback;
permission decisions and browser location acquisition are handled by their respective
platforms. Corrupt storage and failed writes are surfaced instead of reporting a
successful save.

## Verification and limitations

The 19 November verification checked route 1, 1A and 2 outbound service type 1 at
their first stops using live KMB responses. The stop catalogue contained 6,745 stops
at that observation time. All three queries returned eligible future departures and
status `wait`. Raw responses, query times, full service identities and calculated
outputs are retained in `evidence/member-b-2026-11-19/data-verification.json`.
These results are time-specific observations, not a claim of continuous availability.

Four deterministic fixtures verified the normal calculation, skipping a bus that
is too soon, missing ETA, and an expired response. The current full suite passed
33 data tests and three browser integration tests; the production web build also
passed. Browser tests use controlled API fixtures; they are distinct from the three
live API checks. A fresh npm audit reported zero known vulnerabilities for the checked
dependency tree. This does not prove the application has no security defects.

The earlier APK was tested on an emulator, including native location with simulated
coordinates. Physical-device positioning, the final APK after subsequent UI changes,
and broader user testing remain separate team checks. This verification does not
claim to have completed those checks. Other limitations include changing or missing
operator estimates, device-clock errors, user-entered walking times, and no
multi-operator routing, background notification service or cloud account sync.

## Sources and implementation evidence

- KMB/Long Win dataset: https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb
- API base: https://data.etabus.gov.hk/v1/transport/kmb
- API specification: https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf
- Implementations: `packages/data/src/kmb.js`, `departures.js`, `commute.js`,
  `location.js`, and `favourites.js`.
- Reproduction: `node packages/data/scripts/verify-member-b.js /tmp/b-verification.json`
  from the repository root, followed by `npm test`, `npm run test:ui`, and `npm run build`.
