# Interface iteration — 20 November 2026

## Evidence and changes

| Evidence | Source and status | Change | What still needs checking |
|---|---|---|---|
| “颜色有点多的感觉” / too many colours | Anonymous feedback supplied by the team in screenshots; not a new interview | Consistent mist-purple palette and dark-purple active controls, retained in this update | Whether users recognise primary and secondary actions |
| “中间那个太醒目，下面两个按键又太淡” / centre too dominant, lower buttons too faint | Anonymous feedback supplied by the team in screenshots | Rebalanced emphasis and stronger bottom navigation, retained in this update | Whether users find Nearby and Settings without help |
| Numbered stops overlap at busy locations | Observed during interface review, not attributed to a participant | Nearby stops cluster into a count; expanding reveals individual markers. Map and list selection share a highlight | Can users select the correct side/platform without opening the wrong service? |
| Search, location, example and coordinate controls compete for attention | Interface review finding | Search and device location are prominent; examples and manual input are in an expandable section | Do first-time users understand the starting options? |
| Long names, distances and IDs share one line | Interface review finding | Stop names and distances use separate lines. IDs and service metadata are expandable | Readability with long names and translated text |
| “查看路线” was expected to navigate to the stop | Explicit team clarification with a map-popup screenshot | Primary popup action is “步行导航到此站”; secondary action is “查看公交线路” | Android location permissions and whether the walking path matches real pedestrian access |

## Suggested presentation explanation

> We simplified the stop-selection flow based on feedback and interface review. Search and location are now the main entry points, while less frequent options are expandable. Crowded stops are grouped on the map, and choosing a stop highlights the matching list entry. We also separated walking directions from bus services: the main popup button opens an in-app walking-route view for that exact stop, while another button shows the available bus routes.

## Boundaries

Automated tests and developer UI checks are functional evidence, not proof that users find the app easy to use. No completion rate, satisfaction score or participant quote has been invented. The worksheet in `USABILITY-TEST.md` is ready for 3–5 actual participants.

The walking path is now drawn inside the app using the FOSSGIS OSRM walking service. Users choose device location or an explicit manual origin; the app discloses that the routing service receives these coordinates. Denied location, no route and network errors never substitute a public example or a straight-line path. Route time is not automatically imported into the commute calculation. This is a route preview, not live turn-by-turn guidance. Android installation, device location and on-street route accuracy still need testing on a real phone.

## References

- [FOSSGIS routing service and usage policy](https://routing.openstreetmap.de/about.html)
- [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service)
- [Leaflet MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster)
