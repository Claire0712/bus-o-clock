# Bus o'Clock

**Know when to head out.**

Bus o'Clock is a planned location-based Android commuting assistant for Hong Kong. It combines real-time bus arrival estimates with your walking time and a configurable buffer to suggest when to leave for your stop.

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

Project initialized. Application implementation and Android packaging have not started.

Developed as an LSGI3212 Mobile GIS and Location-Based Services group project.
