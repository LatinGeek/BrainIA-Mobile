# M02 independent verification (r2 supersession)

Date: 2026-10-18. Repository: `D:/Coding/BrainIA/BrainIA-Mobile` (branch `main`, HEAD `a526b3498fff63df5374c72c11ab09ccc39d13fc`, dirty tree, **73** `git status --porcelain` entries). Verifier: independent of the M02 implementer; this worker authored only this report. No application, native, contract, configuration, dependency, or signing file was edited; no commit, install, APK/AAB build, device run, live-server call, key-material read, key rotation, or history rewrite was performed. This file supersedes the 2026-10-15 `M02-verification.md`, which reviewed 11 tests and the stale `312c92f8…` contract tree.

**Verdict: M02 accepted-with-conditions.**

The four M02 acceptance criteria are met by static inspection, an isolated credential-lifecycle probe against the real `lib/storage.ts`, the offline-classification probe against the real sealed transport, and 21 passing JVM tests. No rejection trigger was found: the v2 bearer token is not written in plaintext to preferences, logs, or backups; an explicit empty selection is proven to capture zero on every capture path; the migration fails closed to a visible re-authentication rather than downgrading; and enrollment/rotation/revocation/logout/expiry behave correctly in the probe. Conditions are device evidence, signing custody/Play continuity, the untracked reproducibility set, an out-of-reservation `lib/api.ts` edit, the pre-existing browser-harness failure, and several low-severity lifecycle/UX gaps listed in §7.

## 1. Command evidence

All commands ran from `D:/Coding/BrainIA/BrainIA-Mobile` unless noted. `NODE_ENV=development` was set for Gradle.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | **0** | `expo lint`; no diagnostics. |
| `npm run typecheck` | **0** | `tsc --noEmit`; no diagnostics. |
| `npm run contracts:verify` | **0** | `PASS 912 contract checks; 152 positive/negative schema+semantic fixtures; 7 identity sequences`; manifest `666af99fd84d08d43217c380993abcd1540dac66e9a99f618b43a79b2bebfb55`; `PASS 204 mobile conformance checks; approved manifest 666af99f…bfb55; 15 sealed files; 5 pinned extension files; 111 $defs; 19 OpenAPI paths`. |
| `android/: .\gradlew.bat :app:testDebugUnitTest --rerun-tasks` | **0** | `BUILD SUCCESSFUL`; XML result `tests=21 failures=0 errors=0 skipped=0`. |
| `android/: .\gradlew.bat testDebugUnitTest` | **1** | Aggregate task fails in **unrelated** `:expo-modules-core:testDebugUnitTest`: “test sources present and no filters are applied, but the test task did not discover any tests to execute.” `:app:testDebugUnitTest` was `UP-TO-DATE`/passing, not the failure. |
| `npm run agent:harness` | **1** | Static checks and `REVIEW_LOADING_OK`, `REVIEW_EMPTY_OK`, `REVIEW_EDITING_OK`, `REVIEW_AGENT_SMOKE_OK`, `CAPTURE_TRANSFER_AGENT_SMOKE_OK` pass; then `scripts/transaction-edit-agent-smoke.mjs:66` times out after 120 s waiting for `getByText('Tipo de movimiento')` to be hidden (“242 × locator resolved to visible”). Same pre-existing failure recorded in `M01-r1.md`, `M01-verification.md`, `mobile-contract-review.md:195`, and `M02-r1.md`. The script/screen is outside M02. Port 8090 was closed afterwards; verified no listener remains. |
| SDK `adb devices` | **0** | `List of devices attached` with no devices. `adb` is not on PATH; the SDK binary from `android/local.properties` was used. |
| Temp credential probe (main) | **0** | `SUMMARY pass=29 fail=0` (§3). |
| Temp credential probe (malformed, fresh process) | **0** | `SUMMARY pass=3 fail=0` (§3). |
| Temp offline probe (real sealed transport + approved fixtures) | **0** | `SUMMARY pass=10 fail=0` (§4). |
| Guard probe: clean properties | **0** | `GUARD_PASSED` from the verbatim guard block. |
| Guard probe: dummy `BRAINIA_RELEASE_*` key | **1** | `GradleException`: “Release signing values must be supplied through the environment or the user Gradle home, never the project tree. Remove: BRAINIA_RELEASE_STORE_FILE” — key name only, no value. |

`connectedDebugAndroidTest` was **not** run. There is no M02 instrumentation suite, zero devices, and a build-only exit would not be device evidence. It is reported as blocked, not as a pass.

## 2. Acceptance table

| Criterion / required check | Assessment | Evidence |
| --- | --- | --- |
| Empty selection captures zero notifications | **PASS, static + JVM; device blocked** | `NotificationBridgeConfig.shouldCapture` is exactly `configured && selected.contains(packageName)` (`NotificationBridgeConfig.kt:145-146`). The posted path (`Service.kt:102`), reconciled path (`:153`), and the final send re-check (`:194`) all use the same resolver (`:298-306`). Explicit-empty is a committed state (`Module.kt:179-184`). Six consent tests cover unconfigured, explicit empty, last-app removal, exact membership, legacy-empty migration, and versioned non-rewrite. |
| No plaintext key in prefs/logs/backup | **PASS for the v2 token and capture credentials; legacy v1 caveat** | Token only through SecureStore (`lib/storage.ts:179-266`); native code has no v2 token key or writer; `configure` writes only `baseUrl` (`Module.kt:24-41`); diagnostics redact credential shapes (`Config.kt:130-143`); `allowBackup="false"` plus all-domain exclusions in both XML files (asserted by JVM). Probe confirms the token appears only under the SecureStore token/meta keys. Legacy `apiKey`/`clientId` can remain plaintext until a verified migration succeeds (`Module.kt:44-68`, `storage.ts:73-99`) — no new plaintext write, but installed-device cleanup is unverified. |
| Secure migration preserves session or prompts visible reauth | **PASS, static + probe; device blocked** | Encrypted JS value wins; legacy native-only value is rewritten and verified before removal; pre-M02 v2 token is adopted with neutral metadata; revoked marker wins over a leftover token; malformed/unknown-version metadata returns `null` and `recovery_required` plus the visible “Vuelve a iniciar sesión” alert (`storage.ts:317-355`, probe checks 9-12). |
| Rotation/history rewrite only with human approval | **PASS for actions taken** | No rotation, history rewrite, or keystore read performed by implementer evidence or this verifier. HEAD history still contains the four `BRAINIA_RELEASE_*` names; values were not reproduced. Custody/Play continuity remains human-gated. |
| Credential lifecycle: enroll/read/rotate/revoke/logout/expiry; monotonic rotation; adoption; malformed fail-closed; serialized writes | **PASS, probe** | 29 lifecycle checks + 3 fresh malformed checks (§3). |
| Consent: unconfigured vs explicit empty vs selected; versioned migration; empty captures zero on every path; JVM tests pass | **PASS, static + JVM** | §5; 21/21 tests. |
| M01 offline fix: transient PENDING during capabilities, no observation send | **PASS, real sealed transport** | 10 probe checks (§4). |
| No token display or logging | **PASS** | No `console.*` in the inspected JS paths; native logs contain fixed messages/status only; the token input is `secureTextEntry`; stored value is never rendered; status snapshots are non-secret. |
| Settings enrollment/rotation/revoke/logout require explicit confirmation | **PASS with note** | Revoke and logout use destructive `Alert.alert` with a cancel action (`app/settings.tsx:200-212`). Enrollment and rotation require opening a dedicated sheet, pasting a secret, and pressing an explicit “Guardar credencial/rotación” submit (`:434-463`); there is no additional confirmation dialog for rotation. This is deliberate user submission, not accidental one-tap behavior, but a rotation confirmation dialog would better protect against replacing an active credential. |
| Signing: working tree no plaintext release values; HEAD names still present | **PASS source/guard; custody BLOCKED** | Working-tree `android/gradle.properties` has zero `BRAINIA_RELEASE_*` lines. HEAD `android/gradle.properties:65-68` still contains four such definitions (names only: `STORE_FILE`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). Guard probe fails on presence and passes when absent (§6). No key material opened. |
| Guard fails on `BRAINIA_RELEASE_*` and normal builds work | **PASS** | Guard extracted verbatim from `android/app/build.gradle:16-33`, executed under Gradle 9.3.1: clean exit 0, dummy-key exit 1 naming only the key. The real `:app:testDebugUnitTest` build also succeeded with the current clean properties. |
| Scope: only reserved/authorized paths | **CONDITION** | `lib/api.ts` (not in M02’s write reservation) carries M02 token wiring and the M01 offline fix; backup XML and JVM test are untracked and outside the literal reservation. See §7. |

## 3. Credential lifecycle probe

Scratch directory outside the repository: `C:/Users/germa/AppData/Local/Temp/opencode/m02-verify-js`. The probe transpiles the real `lib/storage.ts` and runs it with an in-memory SecureStore, a fake Android platform, captured `Alert.alert` calls, and no repository test file. It does **not** certify AndroidKeystore, envelope compatibility, or device behavior.

`PASS 29` (main process):

1. Initial state `unconfigured`; token read `null`.
2. Enrollment → `active`, generation 1, token readable.
3. Rotation → generation 2, `rotatedAt` set, new token readable, old value gone.
4. Short and whitespace-bearing tokens rejected.
5. Already-expired enrollment rejected; the existing token was not replaced.
6. Expired stored credential → status `expired`, token not returned, visible re-authentication alert raised.
7. Revocation → `revoked`, `revokedAt` set, token deleted.
8. Logout → `revoked`, token deleted.
9. Pre-M02 token without metadata → adopted `active`, generation 1, no expiry, token preserved, metadata written.
10. Revoked marker wins over a leftover token (no resurrection).
11. Malformed metadata → `recovery_required`, token `null`.
12. Unknown metadata version → `recovery_required`, token `null`.
13. Token value appears only under `brainia_mobile.v2AccessToken` (metadata key holds the record, not the token).
14. Three concurrent enroll/rotate calls serialize: final generation 3, final token matches the last rotation.
15. ISO-8601 expiry parsed and persisted.
16. Web platform is memory-only: no SecureStore writes; in-session read works.

`PASS 3` (fresh malformed process): malformed metadata → token `null`, status `recovery_required`, visible “Vuelve a iniciar sesión” alert. A fresh process is required because the alert is intentionally latched once per session.

Not exercised by the probe: real AndroidKeystore key invalidation, Expo envelope format on device, process death during the token-then-metadata write window, clock changes, and backup/restore.

## 4. M01 offline classification probe

Scratch directory: `C:/Users/germa/AppData/Local/Temp/opencode/m02-verify-api`. The probe transpiles the real `lib/api.ts`, stubs only `format`/`domain`/`diagnostics`/`storage`, loads the **real sealed** `contracts/brain-ai/2.0.0/mobile/transport.cjs`, and uses approved `fixtures.json` values. No network was contacted.

`PASS 10`:

- Offline during `GET /capabilities` → `PENDING / offline_capabilities`; exactly one request; no observation URL requested.
- Capabilities succeeds, observation fetch fails → `PENDING / offline`; capabilities + observation attempted, no acknowledgement.
- Missing bearer token → `BLOCKED_AUTH / auth_missing`; zero network requests (never unauthenticated).
- `503` capabilities → stays `HELD / unsupported_or_unavailable_capabilities`; not reclassified as offline; one request.

This confirms the wrapper in `lib/api.ts:938-969` preserves server-originated holds and only reclassifies failures observed through its fetcher.

## 5. Consent and JVM evidence

- `resolveCaptureConsent` treats presence of either the v2 state key or the legacy selection key as configured; no key means unconfigured (`NotificationBridgeConfig.kt:96-120`).
- `writeCaptureConsent` writes state, version 2, and the normalized package set in one `commit()`; an empty set is therefore an explicit pause, not absence (`:122-128`).
- `readCaptureConsent` rewrites a legacy record once (`requiresPersist`) and leaves versioned records untouched.
- Legacy empty selection resolves to `EMPTY`, not `UNCONFIGURED`; blank/whitespace packages are dropped.
- `getInstalledCaptureApps` reports selected state from the same resolver (`Module.kt:156-176`); `getNotificationListenerStatus` exposes `captureConsent` and `captureConsentVersion` (`:85-103`); `setCaptureAppPackages` persists explicit empty (`:178-185`).
- The three capture paths all gate on the resolver: posted (`Service.kt:102`), reconciled (`:153`), send (`:194`). A downgrade to pre-M02 code reads only `captureAppPackages`; an empty set still captures zero, so the migration cannot enable capture on downgrade.
- `app/settings.tsx` distinguishes unconfigured/empty/selected copy (`:315-319`), offers “Pausar toda la captura” writing an empty set (`:426-427`), waits for native persistence before updating local state, and alerts on save failure (`:156-168`).
- The 21 JVM tests passed on a forced rerun. They include AES-GCM roundtrip/tamper/wrong-key/short-tag, SecureStore key names, unconfigured/empty/exact-selection/last-app removal, all consent migration cases, diagnostics redaction, key-rotation invalidation, backup-domain exclusions, and the `BRAINIA_RELEASE_*` absence check. They are pure JVM helpers plus static file reads — not Android integration, service lifecycle, Keystore, or device tests.

## 6. Signing evidence

- Working tree: no `BRAINIA_RELEASE_*` line in `android/gradle.properties`. The diff removes the four definitions and also contains a pre-existing ABI narrowing (`reactNativeArchitectures`); the ABI change is not attributed to M02.
- HEAD: the four definitions remain at `android/gradle.properties:65-68`. Their values were **not** reproduced in this report. Removing them from the working tree does not remediate history.
- `android/app/build.gradle:7-14` resolves release values from the process environment first, then the user Gradle home. Lines 129-149 keep a separate release config with no debug-signing fallback.
- Guard test: the exact guard block from `build.gradle:16-33` was copied to a temporary standalone Gradle project and run with the repo wrapper. With clean properties, `probe` succeeded (`GUARD_PASSED`, exit 0). With a dummy `BRAINIA_RELEASE_STORE_FILE` key, configuration failed with exit 1 and printed only the key name. The guard is configuration-time and fails on any `BRAINIA_RELEASE_*` key, including an empty-valued one.
- No tracked keystore/JKS/P12 was found; `*.keystore` is gitignored. No certificate, `apksigner`, Play Console, upload-key, or app-signing relationship was inspected.
- No rotation or history rewrite was performed. Certificate continuity, custody, exposure assessment, Play continuity, and any rotation/recovery decision remain human-gated. The guard only covers `android/gradle.properties`; it does not scan `app/gradle.properties` or arbitrary property files, so it is a regression tripwire, not a complete secret scanner.

## 7. Scope

There is no pre-M02 git snapshot. Comparison uses HEAD `a526b349`, the M00 baseline (72 dirty entries), `M02-r2` §6, and direct hunk inspection. The tree remains a mixture of M01, M02, v1 product/UI, intelligence/telemetry, localization, and generated graph work; file-level attribution of every hunk is not possible.

| Path | M02 relationship | Assessment |
| --- | --- | --- |
| `lib/storage.ts` | Reserved path; v2 lifecycle | In scope. |
| `lib/notification-bridge.ts` | Reserved path; consent version field; credential args no longer forwarded | In scope. |
| `app/settings.tsx` | Reserved path; v2 sheet/actions and consent copy | In scope, but the diff also contains unrelated pre-existing UI/localization edits; the whole file is not an M02 artifact. |
| `NotificationBridgeConfig.kt` | Reserved path; consent resolver/versioning, sanitizer | In scope. |
| `NotificationBridgeModule.kt` | Reserved path; consent migration and status | In scope. |
| `NotificationBridgeService.kt` | Reserved path; shared consent gate | In scope. |
| `android/app/build.gradle` | Reserved path; signing guard | In scope. |
| `AndroidManifest.xml` | Reserved path; backup flags | In scope. |
| `lib/api.ts` | **Not in the M02 reservation** | **Out-of-bound.** Adds the v2 token reader wiring and the M01 offline reclassification. Functionally necessary, but must be ratified under the M01/coordinator reservation rather than treated as M02-authorized. |
| `android/app/src/test/**` (untracked) | Outside the literal reservation | Required verification artifact; must be committed with owner approval. |
| `android/app/src/main/res/xml/**` (untracked) | Outside the literal reservation | Required backup artifacts referenced by the manifest; must be committed or the tree is not reproducible. |
| `android/gradle.properties` | Outside reservation; M02 report says untouched | Working tree removes four definitions. Attribution to M02 is unproven; the removal is correct for security. |
| `NotificationBridgeDiagnostics.kt` | Not listed in `M02-r2` §6 | Modified vs HEAD from earlier work; no M02 edit visible in this revision, but it is in the dirty set. |
| `contracts/` (untracked) | M02 report says untouched | Current manifest hash is the approved `666af99f…bfb55`, so the stale-hash blocker in `mobile-contract-review.md` no longer describes this tree. Untracked, so a clean checkout cannot reproduce it. |
| `package.json` | M02 report says untouched | Diff is only the M01 `contracts:verify` script. No M02 change found. |
| Other screens/components/scripts/graphify/`app/intelligence`/backend | Outside M02 | Pre-existing dirty or untracked work. No M02 write evidence. The backend repository is independently dirty; no cross-repository edit is attributable from the mobile tree. |

No mobile runtime code writes to the backend repository. No out-of-bound **contracts** or **package.json** modification was found for M02; the contract tree now matches the G1 hash.

## 8. Conditions and blocked items

1. **Device evidence (blocked).** Zero ADB devices. Empty-selection zero-capture, upgrade migration, restart/background, Keystore invalidation, secure-store corruption, backup/restore, Doze/OEM, TalkBack, and large-font behavior are unverified. `connectedDebugAndroidTest` was not run; no M02 instrumentation suite exists.
2. **Signing custody / Play continuity (human-gated).** Historical plaintext release definitions remain in HEAD `android/gradle.properties:65-68`. No certificate, upload key, Play relationship, exposure assessment, rotation, or history rewrite was performed. Values were not reproduced.
3. **Reproducibility (condition).** `contracts/`, both backup XML files, and the JVM test are untracked. A clean checkout cannot build or test this tree. Commit them under owner approval.
4. **Scope condition.** `lib/api.ts` is not in M02’s write reservation but contains M02 token wiring and the M01 offline fix. Ratify it under the correct task reservation or move the change.
5. **`agent:harness` red (pre-existing).** Transaction-edit smoke timeout at `scripts/transaction-edit-agent-smoke.mjs:66`; not M02 code. Required harness success is therefore unavailable.
6. **Aggregate Gradle red (dependency).** `:expo-modules-core:testDebugUnitTest` fails test discovery. App tests pass 21/21.
7. **Low: rotation crash-window semantics.** Enrollment/rotation write the token before metadata. A crash between the two writes can leave a new token paired with the previous **valid** metadata (stale generation/expiry), not necessarily “failing” metadata as `M02-r2` §1.4 claims. The next explicit enrollment/rotation repairs it; the failure mode is metadata inconsistency, not unauthenticated send or a resurrected revoked token.
8. **Low: adoption write is outside the serialized queue.** `ensureV2CredentialMeta` writes adopted metadata outside `runSerialized`; a concurrent enrollment/rotation could race with adoption. Not observed under the probe’s sequential calls.
9. **Low: expiry input.** The documented “epoch ms” form is accepted as a `number`, but the settings input is a string parsed with `Date.parse`, so a raw epoch-ms string is rejected. ISO-8601 works.
10. **Low: rotation confirmation.** Rotation has an explicit sheet submit but no additional destructive confirmation; revoke/logout do. Add a confirmation if rotation is considered destructive.
11. **Live v2 behavior (blocked).** Enrollment/rotation/revocation were not exercised against a server; 401/403 pause, receipts, and capability negotiation remain fixture/probe evidence.
12. **M01 linkage (open).** The current contract hash passes `contracts:verify`, but the G1 ledger still records the mobile API reviewer sign-off as outstanding and the artifact self-labels as proposed. This verification supplies no approval.

## 9. Verdict

**Accepted-with-conditions (updated 2026-10-18 after the M02-r3/M01-r2 follow-up; see addendum §10).** No plaintext v2 token leak, no empty-selection capture, no migration downgrade, and no broken credential lifecycle were found. M02 is acceptable on static, JVM, and isolated-probe evidence, subject to the conditions above. Device/connected instrumentation, signing custody, Play continuity, live v2, and the pre-existing harness/aggregate-Gradle failures remain blocked or open and are not fabricated as passes.

## 10. Addendum — M02-r3/M01-r2 re-verification (HEAD `b4c8748`)

Re-verified: 2026-10-18. Current HEAD is `b4c87486d4bd73aba2bfaf09fd5a078a9d79b38e`, parent `cd39363`; clean except untracked `untitled.md`. The implementer reports `M02-r3.md` and `M01-r2.md` describe the parent state; the follow-up changes are committed in `b4c8748`. This addendum is read-only and supersedes only the stale conditions it lists. No device, Play, signing-custody, or live-v2 acceptance is claimed.

### 10.1 Commands (current tree)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | **0** | `expo lint`; no diagnostics. |
| `npm run typecheck` | **0** | `tsc --noEmit`; no diagnostics. |
| `npm run contracts:verify` | **0** | 912 sealed checks / 152 fixtures / 7 sequences; 221 mobile checks; approved manifest `666af99f…bfb55`; 15 sealed, 4 pinned extension, 111 `$defs`, 19 paths. |
| `android/: .\gradlew.bat :app:testDebugUnitTest --rerun-tasks` | **0** | `BUILD SUCCESSFUL`; 21 tests, 0 failures/errors/skips. |
| `npm run agent:harness` | **1** | Five suites pass; pre-existing transaction-edit 120 s timeout at `scripts/transaction-edit-agent-smoke.mjs:66`. Expo stopped; port 8090 closed. |
| SDK `adb devices` | **0** | Zero devices. |
| Temp storage probe | **0** | 36/36 checks, including epoch-ms string/number and invalid/past expiry. |
| Temp offline probe | **0** | 10/10 checks. |

### 10.2 Settings expiry and confirmations

- `lib/storage.ts:240-253` accepts epoch milliseconds as a number **or** a digit-only string, ISO-8601 via `Date.parse`, and empty/omitted as no expiry. The probe confirmed both epoch forms produce the exact millisecond value; `not-a-date` and malformed ISO throw; past epoch strings throw; a rejected expiry leaves the existing token and metadata untouched. This closes prior condition §8 item 9.
- `app/settings.tsx:200-211` routes rotation through a destructive `Alert` with a cancel action before `commitCredential`; revoke (`:213-218`) and logout (`:220-225`) use the same Cancel + destructive-action pattern. Enrollment still saves after the explicit sheet action, as documented. The confirmation styles are consistent. This closes prior condition §8 item 10.
- **Low residual:** the revoke and logout `onPress` async IIFEs still have no `catch`; a storage failure would reject without a visible error. Rotation goes through `commitCredential`, which does catch and alert. This is pre-existing and not a lifecycle break, but it is inconsistent error handling.
- Expiry strings are trimmed first; a whitespace-only `expiresAt` is treated as “no expiry” rather than invalid. The settings UI trims to `null` before calling storage, so the user-facing path is unaffected; this is a low-severity programmatic-input edge case.

### 10.3 Stale `apiKey`/`clientId`

- `lib/notification-bridge.ts:36-52` marks both legacy parameters `@deprecated`, documents that they are ignored, and calls `nativeModule.configure(config.baseUrl…)` with the base URL only. No credential is forwarded to the native bridge.
- Native `NotificationBridgeModule.configure` writes only `baseUrl`; capture reads the Keystore-backed SecureStore envelope. No new plaintext preference copy exists.
- `lib/api.ts` still sends `x-brainia-api-key` / `x-brainia-client-id` to **v1** endpoints (`:973-975`) and remains unchanged. That is the documented v1 transport path, not a v2 credential or notification-bridge forward. This matches `M01-r2.md` §1.

### 10.4 Offline classification documentation

- The transport returns `HELD / unsupported_or_unavailable_capabilities` for an offline capabilities call; the app wrapper returns `PENDING / offline_capabilities`, preserves the envelope, and makes no observation POST. A direct transport probe (exit 0) and the 10-check wrapper probe both confirm this.
- `M02-r3.md` §6 / `M01-r2.md` §4 now state the two-layer behavior accurately. The prior report wording that conflated them is superseded. See `M01-verification.md` §9.4 for the independent check.

### 10.5 Scope, signing, and condition status

- Commit `b4c8748` contains the four contract-extension files, `lib/storage.ts`, `lib/notification-bridge.ts`, `app/settings.tsx`, the two follow-up reports, and generated `graphify-out/` files. No `package.json`, native Android, backend, dependency, or build-artifact change. The `graphify-out/` refresh is generated DoD output but is omitted from the reports’ §8 file tables — a documentation omission, not code scope creep.
- `lib/api.ts` scope is ratified by `M01-r2.md` §1 / `M02-r3.md` §1 under the joint follow-up reservation; the code was not moved. This closes prior condition §8 item 4 administratively (the file still is not an M02-only write).
- `contracts/`, both backup XML files, and the JVM test are now tracked, closing prior condition §8 item 3 reproducibility.
- Current working tree and current HEAD `android/gradle.properties` contain no `BRAINIA_RELEASE_*` definitions. Older history (initial commit `00f9f83` and descendants before `cd39363`) still contains the historical names/values; no value was read or reproduced here. Signing custody and Play continuity remain human-gated; no certificate, `apksigner`, Play, or key material was inspected, and no rotation/history rewrite occurred.
- Prior §8 items 5-8 and 11-12 remain: pre-existing `agent:harness` failure, aggregate Expo test-discovery failure, the corrected rotation-crash window (stale but valid metadata; generation monotonicity is best-effort across a crash), the unsynchronized adoption metadata write, live-v2 absence, and the outstanding G1 mobile reviewer sign-off. Device/Keystore, backup/restore, and connected instrumentation remain blocked with zero ADB devices.

**Updated M02 verdict: accepted-with-conditions.** The epoch/ISO expiry behavior, rotation/revoke/logout confirmations, deprecation of forwarded bridge credentials, and the two-layer offline documentation are verified. No plaintext secret, empty-selection capture, migration downgrade, broken credential lifecycle, or enabled blocked operation was found. Remaining conditions are device/Keystore evidence, signing custody/Play continuity, live v2, the pre-existing harness/aggregate-Gradle failures, the low residual confirmation error handling, and the M01 extension-pin ordering caveat (see `M01-verification.md` §9.3).
