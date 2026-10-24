# Mobile agent harness

Run this before handing off or packaging any mobile UI change:

```powershell
npm run agent:harness
```

The harness owns its Expo web process and performs three gates:

1. TypeScript type-checking.
2. Expo linting.
3. Focused Playwright checks for Review edge states and Money account transfers.

The review coverage specifically opens the route while no item is selected, renders loading and empty responses, clears the friendly-name field, waits to ensure it stays empty, types a replacement from scratch, and fails on uncaught browser runtime errors. Transfer coverage verifies the dedicated capture mode, cross-currency source/destination controls, and required-account validation. Transaction-editor coverage reclassifies an expense as a UYU-to-USD transfer and verifies the complete update payload.

Use another port when `8090` is unavailable:

```powershell
npm run agent:harness -- --port=8091
```

`npm run smoke:web` remains available when an Expo server is already running. The agent harness is the preferred self-contained pre-build command.

For the broader all-screen smoke suite, run:

```powershell
npm run agent:harness -- --full
```

## Packaging the release APK

Build in place, from `android/`:

```powershell
cd android
cmd /c "gradlew.bat assembleRelease --console=plain"
adb -s <serial> install -r app/build/outputs/apk/release/app-release.apk
```

`npm run share:apk` builds through a junction under `D:\b\…` to keep native
paths short, and that no longer works for this project: a cross-drive junction
(the package on `C:`, the junction on `D:`) fails
`createBundleReleaseJsAndAssets` with "this and base files have different
roots", and a same-drive junction gets past the Android bundle and fails the
same task on the `'use dom'` component (`components/knowledge/GraphForceCanvas`),
whose DOM bundle is resolved through a relative path that climbs to the drive
root. Building in place works: CMake warns that the object directory reaches 185
of 250 characters for `react-native-screens`, and the build completes anyway.

The release keystore is read from `BRAINIA_RELEASE_*` in
`~/.gradle/gradle.properties` (or the environment), so `install -r` upgrades the
installed app without losing its data.
