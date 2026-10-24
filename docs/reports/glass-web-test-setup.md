# BrainIA Mobile web design test setup

Verified on 2026-10-20 on Windows, Node v22.23.3, npm 10.9.9, Playwright 1.61.1. Branch: `LatinGeek/glass-design-polish`; initial HEAD: `fe0c8b5d660b6ccb8e7e6f526fe932431e0f9bdf`.

## Result

The existing Expo SDK 57 / React Native 0.86 / expo-router project exports successfully for web. A local static server is running at **http://127.0.0.1:8092**. Today and Money render populated design previews using the application's existing localhost fixture mode. All six tested routes return HTTP 200 and render without browser `pageerror` events in both default and fixture modes. Live backend data is unavailable; rendered error states are distinguished below from populated previews.

No visual, styling, component, dependency, package-lock, or build-config changes were made. `node_modules` already existed, so `npm ci` was not needed. Existing `app.json` already configures Metro and static web output; `package.json` already contains `react-dom` and `react-native-web`.

## Exact startup commands

Run in the repository root in PowerShell:

```powershell
npx expo export --platform web --output-dir output/audit/web/dist
node output/audit/web/serve.mjs
```

Keep the server command running in a terminal. It binds only to `127.0.0.1:8092`, serves the exported assets, and resolves extensionless route URLs to the corresponding exported HTML. It needs no additional package. Stop that terminal's server with Ctrl+C before restarting on the same port.

Open these URLs directly to preserve the query parameter; it is not guaranteed to survive in-app navigation:

| Screen | Design URL | Observed fixture result | Default route result |
| --- | --- | --- | --- |
| Today / Hoy | http://127.0.0.1:8092/?ux=edge | Populated net movement, insights, finance cards | Screen renders `Datos en vivo no disponibles` |
| Money / Dinero | http://127.0.0.1:8092/financials?ux=edge | Populated expense donut and finance summary | Screen renders `No se pudo cargar Dinero` |
| Explorar / Descubrir | http://127.0.0.1:8092/search?ux=edge | Search controls render; map and recent activity unavailable | Same unavailable states |
| Ajustes | http://127.0.0.1:8092/settings | Preferences, connection settings, reference exchange rate render | Renders normally |
| Revisar | http://127.0.0.1:8092/review?ux=edge | Two pending decisions and Continue control render | Screen renders `No se pudo cargar la revisión` |
| Review session | http://127.0.0.1:8092/review-session?ux=edge | Two review cards with Accept and Skip controls render | Screen renders `Review could not load` |

## Why live data fails

`lib/app-state.tsx` defaults to `https://brain-ia-six.vercel.app`. On localhost, `safeFetchJson` in `lib/api.ts` deliberately rejects that backend before making requests, with `Conecta un backend local en Ajustes para cargar tus datos.` This is the observed reason, rather than a verified `insufficientscope` response. No credentials were supplied or changed, and no backend writes were exercised.

`getLocalPreviewState` in the same file accepts `?ux=edge`, `?ux=empty`, `?ux=loading`, and `?ux=error` only on localhost or 127.0.0.1. The edge fixture supplies Today, Money, and Review data without source changes. It does not populate Explorar's map/recent activity in this setup. A configured working local backend is still needed to test those populated views and real data flows.

## Verification commands and outcomes

```powershell
node --version
npm --version
npx --no-install playwright --version
npx expo export --platform web --output-dir output/audit/web/dist 2>&1 | Tee-Object output/audit/web/export.log
node output/audit/web/serve.mjs
node output/audit/web/capture.mjs 2>&1 | Tee-Object output/audit/web/capture.log
git diff --stat
git status --short --untracked-files=all
git check-ignore output/audit/web/capture.mjs
```

- Export exited 0: web entry bundle and server renderer bundled; 24 static routes exported. Only Node color-environment warnings were emitted.
- Final capture run exited 0: 12 route/mode combinations returned HTTP 200, expected rendered-state markers were found, and no browser runtime errors were recorded. Default error-state markers are intentional assertions, not claims of working live data.
- Screenshots use Chromium, viewport **390×844**, device scale factor 1. Captures wait for their expected text, loaded fonts, and an additional 800 ms. Browser results, complete body text, and failed network requests are in `output/audit/web/results.json`.
- Today, Money, and review-session fixture images were visually inspected. The review-session capture shows the existing stacked-card layout; no layout changes were attempted.
- An initial local server helper rejected paths with HTTP 403 because of trailing-slash normalization; only the helper under the allowed output directory was corrected and the server restarted. The first completed capture run exited 1 because it expected a populated default Review state; assertions were corrected to explicitly verify default error states, and the final run passed.
- An attempted hidden background launch command was rejected by execution policy before running. The server was instead launched as a normal long-running command session.
- No lint/typecheck or full mutation smoke suite was run: there were no application source edits, and this task verifies static export and screen rendering.

## Screenshot files

All images are under `output/audit/web/`:

| Screen | Populated fixture / fixture attempt | Default |
| --- | --- | --- |
| Today | `today-fixture.png` | `today-default.png` |
| Money | `money-fixture.png` | `money-default.png` |
| Explorar | `explorar-fixture.png` | `explorar-default.png` |
| Ajustes | `ajustes-fixture.png` | `ajustes-default.png` |
| Review | `review-fixture.png` | `review-default.png` |
| Review session | `review-session-fixture.png` | `review-session-default.png` |

Reproduce screenshots with `node output/audit/web/capture.mjs` while the server is running. The helper uses the repository's already-installed Playwright package, following its existing smoke-script convention.

## Files and limitations

Added this report and the output-only server/capture helpers, export, logs, JSON evidence, and 12 screenshots. **Build-config changes: none.** `output/` is Git-ignored; artifacts exist locally and must be copied explicitly if shared. Pre-existing untracked reports `glass-design-polish-baseline.md` and `glass-design-polish-plan.md` were preserved. No commit, stash, reset, or clean was performed.

Acceptance is met for web design testing through existing fixture previews. Live backend access, populated Explorar data, mobile-native parity, and review decision submission are outside the verified result.
