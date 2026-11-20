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

## Navigation and first-use flow

Team feedback: the three bottom destinations were difficult to distinguish, and first-time users could not tell where to start. Inspection confirmed that Settings combined app language with the commute-creation form, and selecting a service jumped into that settings screen.

- **Home:** a first-use welcome screen with one main action, “Set up my commute”, and a short explanation of the three steps. Once a commute is saved, Home shows saved journeys and departure advice, with explicit Add and Edit actions.
- **Find stops:** search, location and map-based stop selection. The setup progress indicator continues through Stop → Route → Timing, with explicit back actions. Choosing a route opens a dedicated timing page, not Settings.
- **Settings:** app language, device-storage information and a short usage guide. It contains no stop search, route selection or commute-time form.
- **Timing:** confirms the exact stop, route and direction; saves walking and buffer times; returns to departure advice. Editing an existing commute starts from Home. Returning without saving leaves the stored commute unchanged.

The map popup still offers in-app walking directions. Within the list-based commute setup, “View bus services” is the primary next step. All nine languages include the new first-use and setup text. These are changes in response to team feedback; usability improvement still needs testing with first-time users.

## Suggested presentation explanation

> We simplified the stop-selection flow based on feedback and interface review. Search and location are now the main entry points, while less frequent options are expandable. Crowded stops are grouped on the map, and choosing a stop highlights the matching list entry. We also separated walking directions from bus services: the main popup button opens an in-app walking-route view for that exact stop, while another button shows the available bus routes.

## Boundaries

Automated tests and developer UI checks are functional evidence, not proof that users find the app easy to use. No completion rate, satisfaction score or participant quote has been invented. The worksheet in `USABILITY-TEST.md` is ready for 3–5 actual participants.

The walking path is now drawn inside the app using the FOSSGIS OSRM walking service. Users choose device location or an explicit manual origin; the app discloses that the routing service receives these coordinates. Denied location, no route and network errors never substitute a public example or a straight-line path. Route time is not automatically imported into the commute calculation. This is a route preview, not live turn-by-turn guidance. Android installation, device location and on-street route accuracy still need testing on a real phone.

## References

- [FOSSGIS routing service and usage policy](https://routing.openstreetmap.de/about.html)
- [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service)
- [Leaflet MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster)

## 20 November: review follow-up

- Language selection is visible on the first-use welcome page and in Settings only. Settings offers a return action preserving the interrupted form or map; saved preferences take priority over browser language.
- Route-number searches first show direction/service choices, then boarding stops in sequence. Repeated stops retain their sequence and terminal-only entries are excluded. Stop-name and nearby searches remain available.
- Stop cards offer a direct boarding action. A route-search choice already identifies the full service and can proceed directly to Timing.
- Optional time plans are collapsed on first setup. Inputs explicitly state that walking/buffer times are user estimates, with a clearly hypothetical, dynamically calculated ten-minute arrival example.
- Header and setup spacing are reduced. New copy covers all nine supported interface languages.

Verification: 71 unit tests and 18 browser tests (mocked deterministic APIs), including service identity, backwards navigation, language changes, draft/preset persistence and existing map/walking features. Manual browser inspection also used live route 1A data. This is developer verification, not a completed participant usability study or physical Android validation.
