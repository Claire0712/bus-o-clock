# Public user-needs evidence

Collected on 20 November 2026 for Bus o'Clock. This is a small, purposive review of publicly accessible competitor reviews and discussion comments. It is secondary research, not interviews, a representative survey, or feedback from users of our app. We paraphrased eight distinct comments below; repeated copies of the same review on the App Store page were counted once. No private groups or accounts were accessed.

## Evidence log

Dates below are the dates displayed by the source. Reddit exposed relative dates, so its exact posting dates have not been verified. A complaint records one person's experience; it does not independently establish a current defect in the competing app.

| ID | Source and date | Observed feedback, paraphrased | Our interpretation for Bus o'Clock |
| --- | --- | --- | --- |
| E1 | [App1933 App Store reviews](https://apps.apple.com/hk/app/app1933-kmb-lwb/id1170003707?platform=iphone&see-all=reviews), Kennoel, 07/10/2025 | Ads interrupt looking up buses; bookmarking a particular service and return journey is confusing. | Keep arrival information quick to reach; clearly identify the saved stop, route and direction. |
| E2 | [App1933 App Store reviews](https://apps.apple.com/hk/app/app1933-kmb-lwb/id1170003707?platform=iphone&see-all=reviews), review titled “long article”, 26/03/2024 | Having to download an update while outside makes checking arrivals inconvenient. | Avoid unnecessary setup before the first useful result. This older review is historical evidence, not a claim about the current app. |
| E3 | [hkbus.app Google Play reviews](https://play.google.com/store/apps/details?hl=en_US&id=app.hkbus), Keith, 24 October 2026 | Values fast loading and bookmarks for exact stops because nearby stops can be confused by GPS. | Preserve exact-stop favourites and give users a clear manual alternative to location. |
| E4 | [hkbus.app Google Play reviews](https://play.google.com/store/apps/details?hl=en_US&id=app.hkbus), Uncle Wong, 1 October 2026 | Reports that changed routes are not reflected on the map. The developer's 13 October reply directs the user to update the route database in Settings. | Make freshness and recovery discoverable; fetching data alone is not sufficient UX. We have not independently reproduced the reported mismatch. |
| E5 | [hkbus.app Google Play reviews](https://play.google.com/store/apps/details?hl=en_US&id=app.hkbus), Milan R, 31 October 2026 | Appreciates an ad-free app but says the UX could improve. | General support for a simpler experience; too vague to justify a particular new feature. |
| E6 | [Reddit: Bus arrival times](https://www.reddit.com/r/HongKong/comments/1wail36/bus_arrival_times/), original post; exact date unverified | Full-screen ads slow use and make one-handed operation difficult. | Keep the main arrival action prominent and test the controls while walking or holding a bag. |
| E7 | [Reddit: Bus arrival times](https://www.reddit.com/r/HongKong/comments/1wail36/bus_arrival_times/), comment by guts80; exact date unverified | Explicitly asks for clock-time arrivals instead of relative minutes, and likes browser access without installation. | Consider showing both “8 min” and “14:28”. This is a direct feature request, but only from one commenter. |
| E8 | [Reddit: Bus arrival times](https://www.reddit.com/r/HongKong/comments/1wail36/bus_arrival_times/), comment by pubgPlayer_SK; exact date unverified | Likes an ad-free bus app but wants to enter an origin and destination rather than knowing a bus number. | A stop/route search is a smaller first step. Full journey planning would require additional routing work and is outside the current scope. |

## Proposed priorities, not completed features

1. **Find a stop without reliable GPS.** Add stop-name/route search and make direction clear before saving. Supported by E1/E3; the specific search design is our inference.
2. **Make time easier to interpret.** Show remaining minutes alongside the expected clock time, with the latest update time visible. Supported directly by E7 and indirectly by E4.
3. **Verify the existing core flow.** Test locating or selecting a stop, choosing a service, saving it, and reading departure advice with several actual commuters. E5 is too vague to replace this testing.

The current app already stores route-specific commutes and distinguishes stale/unavailable ETA states. These reviews support improving and testing those behaviours; they do not justify presenting them as newly discovered features.

## Language scope and limits

The nine-language interface responds to our project's requested scope. This sample does **not** demonstrate demand for nine languages, or specifically for Japanese and Korean. Validate that separately with target users, including international students and visitors. Official stop names remain Chinese/English so that users can match physical signage; interface translations still need native-speaker review.

## Suggested primary research next

Ask 5–8 commuters to complete three tasks on a phone: find the correct stop when location is unavailable; save the correct direction; decide when to leave using their own walking time. Record completion, wrong-stop selections, confusing text and comments. This is a planned convenience sample, not research already completed. Include at least one Chinese-interface and one English-interface user, and additional language users if available.

Suitable interview prompts: “Tell me about the last time you missed a bus”; “How do you find the right stop when several are close together?”; “Would you interpret 8 minutes differently from 14:28?” Avoid leading questions such as “Would our app be useful?”
