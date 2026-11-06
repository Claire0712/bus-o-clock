# Bus o'Clock

**Know when to head out.**

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

## Source and integration

- `app.js`, `app.css`, `index.html`: live interface, adapted from the original prototype.
- `packages/data`: KMB client, location, departure calculations, persistence and tests.
- `android`: Capacitor native project and foreground location permissions.
- `tests/app.spec.js`: browser integration and error-state checks.
- `docs/B-INTEGRATION.md`: data-layer API contract.
- `docs/APP-VERIFICATION.md`: final integrated-app verification and known limitations.

Data attribution: [KMB / Long Win on DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb).
Third-party data remains subject to its provider's terms. No walking-route routing,
background notifications, multi-operator planning or account synchronisation is provided.
