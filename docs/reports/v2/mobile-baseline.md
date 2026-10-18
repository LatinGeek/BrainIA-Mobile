# M00 mobile capture and signing feasibility baseline

Audit date: 2026-10-17. Repository: `D:/Coding/BrainIA/BrainIA-Mobile` (mobile repository only). Phase 0, workstreams WS02/WS05/WS13. This audit is read-only except for this report. No application, native, configuration, dependency, migration, or signing file was edited; no APK was built; no device was used; no key material was opened. Backend access was limited to reading the plan documents named by the task.

- HEAD: `a526b3498fff63df5374c72c11ab09ccc39d13fc`
- Branch: `main`
- Dirty state at audit start: **72** `git status --porcelain` entries = 58 modified tracked paths + 14 untracked entries, 0 staged (`git status --porcelain`; `git diff --stat` reports 58 files changed).

**Verdict: BLOCKED.** The read-only investigation is complete, but this working tree cannot be accepted as a pre-G1 baseline. The imported v2 contract still declares itself PROPOSED/UNAPPROVED, no human G1 approval ledger is present in this repository, the tree already contains M01/M02 implementation edits, F11/F14 remain unmet, and no native, signing, or live-contract evidence exists. What remains unverified: human G1 approval and contract closure; notification-listener behavior on a physical device; durable capture across process death/reboot/ack loss; signing custody, Play relationship and source-to-APK binding; Keystore migration/restore behavior; live v2 receipt/auth behavior; OEM background behavior.

## M00 acceptance criteria

Exact wording from `BRAIN_AI_V2_TASK_SPECIFICATIONS.md:51-55`.

| M00 acceptance criterion | Assessment | Exact evidence file:line |
| --- | --- | --- |
| Static findings distinguished from native evidence | PASS. Every section below labels STATIC, ARTIFACT, DEVICE-REQUIRED, or LIVE-BACKEND-REQUIRED; no runtime claim is made from source. | `docs/reports/v2/mobile-baseline.md` "Static vs native evidence matrix"; task spec `BRAIN_AI_V2_TASK_SPECIFICATIONS.md:53` |
| Every mobile uncertainty resolved or assigned gate blocker | PASS within audited scope. Findings map to G-GATE, G-CONTRACT, G-CAPTURE, G-CONSENT, G-CREDENTIAL, G-SIGN, G-DB, G-FX, G-ANDROID, or G-V2-AUTH; no item is silently waived. | Task spec `BRAIN_AI_V2_TASK_SPECIFICATIONS.md:54`; "Uncertainties and assigned gate blockers" below |
| No application edits or native implementation before G1 | FAIL as a repository-state claim. This audit authored only this report, but the tree already contains modified native files and untracked v2/M02 implementation. No G1 approval ledger exists in the repository to authorize them. | `git status --porcelain` (58 modified + 14 untracked); `docs/reports/v2/M02-r1.md:57-78`; `docs/reports/v2/M01-r1.md:33-41`; contract status `contracts/brain-ai/2.0.0/README.md:3` |

## Revision and dirty state

STATIC / ARTIFACT. The baseline requires the working tree, not HEAD alone.

- HEAD is `a526b3498fff63df5374c72c11ab09ccc39d13fc` on `main`; there are no staged changes.
- 58 tracked files are modified, including native source (`android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, four `notification/*.kt` files), `lib/api.ts`, `lib/storage.ts`, `lib/domain.ts`, `lib/format.ts`, `package.json`, and `app/settings.tsx` (`git status --porcelain`).
- 14 untracked entries exist: `contracts/`, `android/app/src/main/res/xml/`, `android/app/src/test/`, `docs/reports/`, `app/intelligence/`, `app/learning.tsx`, several `components/intelligence/*` files, `lib/intelligence.ts`, `lib/interaction-telemetry.ts`, `graphify-out/2026-10-02/`, and two graph/scripts additions (`git status --porcelain`).
- The working tree is not reproducible from HEAD: `lib/api.ts:2` imports `../contracts/brain-ai/2.0.0/mobile/transport.cjs`, and `contracts/` is untracked. A clean HEAD checkout therefore cannot satisfy that import. `package.json:52` also names the untracked verifier.
- The current release output `android/app/build/outputs/apk/release/app-release.apk` is dated 2026-10-03 23:57:12 UTC, before the current dirty changes; it cannot be assumed to correspond to this tree (`Get-ChildItem` metadata).
- Prior reports in the tree describe an earlier snapshot with 50 modified files (`docs/reports/v2/M00-verification.md:8,12`). The difference is explained by M01/M02 edits listed in `docs/reports/v2/M01-r1.md:35-41` and `docs/reports/v2/M02-r1.md:61-78`; those reports are worker-authored claims, not independent proof.
- Rollback/compatibility note: no rollback was performed. Do not `git checkout` or delete untracked paths to "clean" the baseline; that would discard M01/M02 work and the only local contract copy. Any future reset must be a reviewed, serialized decision. There is no local capture database to downgrade (see Room/SQLite section).

## Capture pipeline

STATIC. The Android notification listener is the capture entry point.

- The service is declared with `BIND_NOTIFICATION_LISTENER_SERVICE` and exported in the manifest (`android/app/src/main/AndroidManifest.xml:33-41`); the package is registered in `MainApplication.kt:33`.
- `onNotificationPosted` filters self/empty packages and consent, then submits `sendCapture` to a single-thread in-process executor (`NotificationBridgeService.kt:95-125`). There is no durable write before the HTTP attempt.
- `sendCapture` posts directly with `HttpURLConnection` to `/api/v1/capture/notification` (`NotificationBridgeService.kt:254`), with 10 s connect/read timeouts (`:260-261`). Credentials are read from the SecureStore envelope at request time (`:264-271`).
- The payload is `contractVersion: 1`; `id` and `externalId` are the Android notification key (fallback package+postTime), and `idempotencyKey` is `notif:<key>` (`NotificationBridgeService.kt:220,240-249`). Revision identity, content fingerprint, producer sequence, delivery ID, and source-instance identity are absent.
- Any 2xx closes the stream and returns `true`; the body is not parsed for a receipt (`NotificationBridgeService.kt:277-292`). A 4xx/5xx returns `false` (`:278-283`), but nothing durable retains the payload.
- Retry/recovery is only active-snapshot replay: `reconcileActiveNotifications` calls `getActiveNotifications()` and resends what Android still exposes (`NotificationBridgeService.kt:128-187`, snapshot at `:135`). A dismissed or offline notification is not recoverable. No `onNotificationRemoved` override exists (search of all `notification/*.kt` returned zero matches).
- No persistent capture queue/outbox, dead-letter store, delivery lease, batch endpoint, or per-item result handling was found in `android/app/src`, `lib/`, `package.json`, or `android/app/build.gradle` (search for `outbox|queue|Room|SQLite|SQLCipher`; only the diagnostics queue and in-memory telemetry queue matched).
- The persisted listener diagnostics queue stores at most 150 JSON events in SharedPreferences and uploads in batches of 50 (`NotificationBridgeDiagnostics.kt:21-22,57-63,84-103`). It stores event messages and metadata such as package name, not notification title/body, so it cannot reconstruct lost captures (`NotificationBridgeDiagnostics.kt:37-56`).
- WorkManager is used only for listener health/reconnect. `MainApplication.kt:48-52` schedules a 30-minute worker named `brainia-notification-reconciliation`; `NotificationReconciliationWorker.kt:46-55` schedules a different 15-minute periodic worker `brainia-notification-listener-health-v2`. These are duplicate recovery mechanisms, not a delivery pipeline.
- Manual capture in `app/(tabs)/capture.tsx:341-440` calls `client.capture` (`:419`); that client route is v1 `/api/v1/capture/{note|wallet|...}` (`lib/api.ts:1375-1385`). On failure it shows an error and drops the draft (`app/(tabs)/capture.tsx:435-437`); there is no local queue.

Conclusion: capture delivery exists as a best-effort side effect, not as durable evidence capture. M03/M04 have no existing outbox to extend.

## F11-F14 mapping

Definitions are the architecture findings and the PRD outcomes that reference them; `BRAIN_AI_V2_ARCHITECTURE.md:25-28` defines F11-F14, and `BRAIN_AI_V2_PRD.md:31,44,52,56` defines the required outcomes.

| Item | Requirement (source) | Status | Evidence | What is missing |
| --- | --- | --- | --- | --- |
| F11 durable capture and revisions | Offline capture committed locally before network delivery; queue removes only a matching acknowledged revision; zero loss over 10,000 persisted captures (`BRAIN_AI_V2_PRD.md:31,44`; `BRAIN_AI_V2_ARCHITECTURE.md:25`) | **Partial** | Direct send and 2xx acceptance: `NotificationBridgeService.kt:115-124,254,277-292`; active-snapshot replay only: `:128-187`; no `onNotificationRemoved`; v1 key-only identity: `:220,240-249`; no outbox dependency: `android/app/build.gradle:178-182` | Durable local commit, delivery/receipt states, revision/sequence identity, retry/backoff classification, batch/per-item handling, ack-loss recovery, removal semantics, queue bounds |
| F12 consent and native credential duplication | Empty selection captures nothing; credentials must not be duplicated in plaintext native storage (`BRAIN_AI_V2_ARCHITECTURE.md:26`; `BRAIN_AI_V2_PRD.md:31`) | **Partial** | Consent: `NotificationBridgeConfig.kt:61-62`, `NotificationBridgeModule.kt:88-89,177-183`, UI `app/settings.tsx:250-255,342`, tests `android/app/src/test/java/com/brainia/mobile/notification/NotificationBridgeSecurityTest.kt:52-80`. Credential: `NotificationBridgeConfig.kt:30-47`, `lib/storage.ts:66-99,101-161` | Device proof of zero capture, migration from older installs, rotation/revocation/enrollment, 401 pause, atomic logout/account switch, backup/restore and Keystore-invalidation proof |
| F13 signing provenance | Release keystore presence and signing configuration must be assessed without key material; provenance/distribution must be verified by an owner (`BRAIN_AI_V2_ARCHITECTURE.md:27`) | **Unverified** | `android/app/release.keystore` exists (2,794 bytes, 2026-07-14); release config `android/app/build.gradle:110-129,135-138`; ignored by `.gitignore:16`; no tracked keystore (`git ls-files`); APK metadata below | Custody/ownership, Play upload/app-signing relationship, certificate continuity, source-to-APK binding, exposure assessment of secrets committed at HEAD |
| F14 dated explicit FX | Remove fixed implicit conversions and require a dated explicit rate; no mixed-currency total without rate/time (`BRAIN_AI_V2_ARCHITECTURE.md:28`; `BRAIN_AI_V2_PRD.md:31`; `BRAIN_AI_V2_API_CONTRACT_v2.0.0.md:133`) | **Missing** | Fixed `UYU_PER_USD = 40` and conversion: `lib/format.ts:84,92-97`; summary applies it: `lib/financial-summary.ts:8-23`; call sites `app/(tabs)/index.tsx:38`, `app/(tabs)/financials.tsx:136,264,508-536`; label `components/trust/index.tsx:73`; setting display `app/settings.tsx:186-190` | Dated rate source/id/provider/asOf, requirement enforcement, unsupported/ambiguous currency exclusion, decimal arithmetic, correction of all total paths |

F11-F14 status count: **implemented 0; partial 2 (F11, F12); missing 1 (F14); unverified 1 (F13).**

## Credential and key lifecycle, and consent

STATIC. The working tree has materially changed since the earlier baseline and closes part of F12 statically.

Credential path:
- JS uses `expo-secure-store` for `brainia_mobile.apiKey` and `brainia_mobile.clientId` (`lib/storage.ts:1,66-69,119`). Android native code no longer stores its own credential copy.
- Native `readCredential` reads the `SecureStore` SharedPreferences envelope and decrypts it with the AndroidKeystore AES key (`NotificationBridgeConfig.kt:30-47`). It requires scheme `aes` and `requireAuthentication == false` (`:39`), and builds the alias `AES/GCM/NoPadding:key_v1[:keystoreUnauthenticated]` (`:40-41`).
- This matches the installed `expo-secure-store` implementation: default `key_v1` (`node_modules/expo-secure-store/android/src/main/java/expo/modules/securestore/SecureStoreModule.kt:385`), unauthenticated suffix (`:387`), AES/GCM alias (`node_modules/expo-secure-store/android/src/main/java/expo/modules/securestore/encryptors/AESEncryptor.kt:34-50,136-137`). This is a static version coupling, not device proof.
- Migration precedence reads the encrypted JS value first; a native-only legacy value is imported, rewritten through SecureStore, verified through the native reader, then removed (`lib/storage.ts:71-99`; `NotificationBridgeModule.kt:44-68`). Writes are serialized per key (`lib/storage.ts:130-138`); deletion clears secure and legacy copies in sequence (`:141-161`).
- `configure` now receives only `baseUrl` and stores it (`NotificationBridgeModule.kt:24-41`); `lib/notification-bridge.ts:34-44` still accepts `apiKey`/`clientId` arguments but does not pass them. This is harmless but stale API surface.
- No credential enrollment, rotation, revocation, expiry, device registration, or per-install capture credential exists. There is no v2 bearer provisioning: `ClientConfig.accessToken` is defined (`lib/api.ts:29`) and passed to the transport (`:936`), but `lib/app-state.tsx:143-151` never supplies it.
- `resetSettings` writes default/empty values (`lib/app-state.tsx:173-185`); empty credentials flow through `deleteStoredValue` semantics (`lib/storage.ts:141-161`). It does not atomically clear consent, scheduled work, in-flight requests, or native state. The settings persistence effect is fire-and-forget (`lib/app-state.tsx:116-129`).
- Backup is disabled and custom rules exclude all domains: `AndroidManifest.xml:16` sets `allowBackup="false"` plus both rule references; `android/app/src/main/res/xml/brainia_backup_rules.xml` and `brainia_data_extraction_rules.xml` exclude `sharedpref`, `file`, `database`, `root`, `external`, and device-protected variants. These XML files are untracked.
- Risk: native decryption depends on Expo SecureStore internals (`SecureStore` prefs name, `key_v1` alias, `usesKeystoreSuffix`, envelope JSON keys), so an Expo upgrade can silently break native capture without a compile error (`NotificationBridgeConfig.kt:35-46`).

Consent:
- `shouldCapture` returns true only when the selection key exists and contains the exact package: `configured && selected.contains(packageName)` (`NotificationBridgeConfig.kt:61-62`).
- Status distinguishes `unconfigured`, `empty`, and `selected` (`NotificationBridgeModule.kt:88-89`), and the UI explains that unconfigured/empty capture nothing (`app/settings.tsx:250-255`) and offers "Pausar toda la captura" (`:342`).
- The listener still rejects names containing `brainia` (`NotificationBridgeService.kt:299-302`), and installed-app enumeration excludes system apps and apps without launch intents (`NotificationBridgeModule.kt:160-165`). These are deliberate filters but can hide a legitimate source; needs a product decision.
- The earlier finance-app fallback is gone: tests assert unconfigured/empty finance packages do not capture (`NotificationBridgeSecurityTest.kt:52-62`). These are JVM tests, not device tests.

Key-lifecycle conclusion: static consent ambiguity is resolved in this tree; credential duplication is resolved statically. Rotation/revocation/enrollment, 401 handling, atomic logout, Keystore invalidation, restore, and real device behavior remain open (G-CREDENTIAL, G-CONSENT).

## Signing provenance

ARTIFACT / NOT READABLE. No key material was opened, printed, hashed, exported, or copied.

- `android/app/release.keystore` exists at 2,794 bytes, modified 2026-07-14 20:47:41 UTC. `android/app/debug.keystore` exists at 2,257 bytes, 2026-07-14 01:11:47 UTC. Both are ignored by `.gitignore:16` and are not tracked (`git ls-files`).
- Release signing resolves four names from the process environment or the user Gradle-home `gradle.properties`, never project properties (`android/app/build.gradle:7-14,117-129`); the release build type selects that config (`:135-138`). If any value is absent, `storeFile` is not set, so a release build has no signing identity despite selecting `signingConfigs.release`.
- **Committed-secret finding:** HEAD's `android/gradle.properties` contains four release-signing definitions at lines 65-68 (`BRAINIA_RELEASE_STORE_FILE`, `_STORE_PASSWORD`, `_KEY_ALIAS`, `_KEY_PASSWORD`; values intentionally not reproduced here). The working tree removes those lines (`git diff -- android/gradle.properties`), but the removal is uncommitted and history is unchanged. This is a potential prior credential exposure; no rotation or history rewrite was performed.
- Existing APK: `android/app/build/outputs/apk/release/app-release.apk`, 51,196,192 bytes, 2026-10-03 23:57:12 UTC, SHA-256 `1B6D65B83F1768FF6CB1601EBC06531B7B10F5989AF13F6EA2BC2B083FDDE9A6`. Adjacent `output-metadata.json` says release/SINGLE, `com.brainia.mobile`, versionCode 8, versionName 1.0.7. `aapt2 dump badging` independently reported versionCode 8/versionName 1.0.7, minSdk 24, targetSdk 36, compileSdk 36.
- Not verified in this audit: APK signature validity (no `apksigner` run), certificate identity, whether the APK used `android/app/release.keystore`, Play upload/app-signing relationship, distribution history, and correspondence to HEAD or the dirty tree. The APK predates the current tree by 14 days.
- Explicit statement: signing provenance is **not readable and not verified** here. A valid artifact or a local keystore file does not prove ownership or custody. An authorized signing owner must attest certificate continuity and Play relationships privately and bind a reviewed build to a source manifest.

## Room/SQLite encryption

STATIC negative finding.

- No Room, SQLCipher, `expo-sqlite`, AsyncStorage, MMKV, or Realm dependency exists (`package.json:5-33`; `android/app/build.gradle:178-182` contains only React Native, WorkManager 2.10.0, JUnit, and image codecs). Searches for `Room|RoomDatabase|SQLCipher|sqlite|SQLite|AsyncStorage|MMKV|realm` across `android/app/src`, `lib/`, `package.json`, and `android/app/build.gradle` returned no application database.
- WorkManager persists schedule state in its own unencrypted database, but no capture payload is stored there; it only schedules reconciliation (`NotificationReconciliationWorker.kt:46-62`).
- Listener diagnostics persist in ordinary `MODE_PRIVATE` SharedPreferences (`NotificationBridgeDiagnostics.kt:57-63,140`), up to 150 entries, including an installation UUID and package names (`:33,43-55,142-149`). They do not contain notification title/body, but they are plaintext-at-rest metadata and must be included in any privacy/encryption review.
- SecureStore values are AndroidKeystore-encrypted (`NotificationBridgeConfig.kt:30-47`; Expo AES code above), but SecureStore is a small key-value store, not a durable capture queue.
- Therefore the durable outbox does **not exist**, so it cannot be described as encrypted. There is no implemented Room/SQLite encryption design to validate. M03 must choose and approve the provider (Room + SQLCipher or reviewed payload encryption), key generation/wrapping in AndroidKeyStore, migration, WAL/SHM/journal handling, backup exclusion (already globally excluded), and corruption/key-loss behavior.

## Contract feasibility and Android/OEM gaps

STATIC. The v2 contract is imported but unapproved and not wired to native capture.

Contract status and provenance:
- The imported bundle says "PROPOSED / UNAPPROVED SUBSET" (`contracts/brain-ai/2.0.0/README.md:3`), `approvalReady:false` (`contracts/brain-ai/2.0.0/open-items.json:3`), and 30 open decisions (`open-items.json`, `"status": "open"` count 30). The backend contract is also "PROPOSED / UNAPPROVED" (`BRAIN_AI_V2_API_CONTRACT_v2.0.0.md:3`).
- The bundle manifest hash is `312c92f8f71c9f98ad3d2d6986e26bd941485332ded516b4052ca14b052abad6` (`Get-FileHash contracts/brain-ai/2.0.0/SHA256SUMS.json`), matching the pin in `contracts/brain-ai/2.0.0/mobile/verify.mjs:11`. `spec.md` and the backend doc both hash to `401F19773EBFEF4A282E7DA1256737E8E4597972862ACAB98674451EDF4DC61C`; they are byte-identical.
- `M01-r1.md:10-13` claims a G1 handoff authorized this exact import and records the same manifest hash, but it also says the import does not close the 30 decisions. No approval ledger (version, artifact hashes, backend reviewer, mobile reviewer, human approver, timestamp, expiry) is present in this repository; the contract requires one (`BRAIN_AI_V2_API_CONTRACT_v2.0.0.md:9`). This audit cannot verify human G1 approval.

What exists on the mobile side:
- A strict JS transport is imported at `lib/api.ts:2` and instantiated as `client.v2` (`:936`). It validates allowlisted `/api/v2/` operations, rejects duplicate JSON names, and validates response/receipt identity (`contracts/brain-ai/2.0.0/mobile/transport.cjs:7-36`; `lib/api.ts:936`).
- `V2Envelope` and `V2QueuedRevision` types exist (`lib/domain.ts:4-26`), but no screen or native code uses them (search for `V2Envelope|V2QueuedRevision|.v2.` found only the definitions, import, and transport assignment).
- No `accessToken` is provisioned (`lib/api.ts:29,936`; `lib/app-state.tsx:143-151`), so any v2 request would be unauthenticated.
- Native capture remains v1 (`NotificationBridgeService.kt:241,254`); no Kotlin code references `deliveryId`, `producerRevision`, `fingerprint`, or `batch` (search of `notification/*.kt`).

Feasibility by contract element:

| Contract element | Feasible with current mobile stack? | Concrete gap |
| --- | --- | --- |
| Envelope identity (`deliveryId`, `sourceInstanceId`, `sourceObservationKey`, `producerRevisionId`, `producerSequence`, fingerprint, changeKind) | Yes in JS; not in native | Native has only Android notification key and `contractVersion:1` (`NotificationBridgeService.kt:220,240-249`); no durable sequence allocator, no source-instance provisioning, no fingerprint computation in Kotlin |
| Single observation `POST /api/v2/observations` and receipts | Yes in JS transport (`transport.cjs`, `verify.mjs` receipt checks) | Native never calls it; 2xx-only acceptance (`NotificationBridgeService.kt:277-292`); no receipt persistence |
| Batch `/api/v2/observations/batch` (<=50/1 MiB, ordered per-item results) | JS transport can form/validate a batch; native cannot | No batching, no partial-failure state, no queue to iterate (`NotificationBridgeService.kt`; no outbox) |
| Decimal strings and exact financial DTOs | Partially | UI/API still use JS numbers for money (`lib/api.ts:888-891`; `app/(tabs)/capture.tsx:342-343`), and `parseCurrency`/`convertCurrency` use floats (`lib/format.ts:92-103`); v2 decimal DTOs are defined but unused |
| Corrections with `expectedVersion` | No | `CorrectionPanel` posts to v1 `/classification/teach` (`components/intelligence/CorrectionPanel.tsx:42`); no `expectedVersion`/409 handling anywhere in `lib/api.ts` or screens |
| Auth/enrollment/401 pause | No | Only v1 headers are sent (`lib/api.ts:929-931`; native `NotificationBridgeService.kt:264-271`); no bearer provisioning or pause state |
| Dated FX / capability advertisement | No | Fixed rate in `lib/format.ts:84-97`; no capabilities use in UI or native code |
| Contract/version gating and unknown-enum handling | Yes in JS transport; not wired to UI | Transport fails closed, but screens still consume v1 normalizers and fixed enum strings |

Android/OEM risks (DEVICE-REQUIRED):
- Listener binding/revocation, Android 14+ unbind/rebind cycle, Android 15/16 sensitive-notification redaction, reboot/direct-boot, Doze/battery restrictions, force-stop, managed profiles, and OEM autostart/kill behavior have no runtime evidence. The code contains OEM workarounds and comments about Xiaomi process kills and stale binding (`NotificationBridgeService.kt:386-436`); these are hypotheses.
- The APK is arm64-v8a only (`android/gradle.properties:31`; `aapt2` native code) and minSdk 24; x86 emulators and 32-bit devices are not covered.
- The app requests broad `QUERY_ALL_PACKAGES` (`AndroidManifest.xml:4`) and filters system apps (`NotificationBridgeModule.kt:160-165`); Play policy suitability and source visibility need a decision.
- There is no iOS notification bridge; non-Android calls return unsupported/default values (`lib/notification-bridge.ts:39-43,47-51,55-57`).

## Static vs native evidence matrix

| Claim | Evidence class | Proven now? | What would prove it |
| --- | --- | --- | --- |
| Listener is declared and wired into React Native | STATIC | Yes: `AndroidManifest.xml:33-41`, `MainApplication.kt:16,33` | Android binds the service on a device |
| Capture posts to v1 and accepts 2xx | STATIC | Yes: `NotificationBridgeService.kt:254,277-292` | Live backend receipt trace; device log |
| No durable capture queue/outbox | STATIC negative | Yes for searched paths: `android/app/src`, `lib/`, `package.json`, `build.gradle`; no Room/SQLCipher/queue | Code review of future M03; device DB inspection after implementation |
| Empty selection captures zero | STATIC + JVM fixture | Code/tests: `NotificationBridgeConfig.kt:61-62`, `NotificationBridgeSecurityTest.kt:52-80` | Device test with notifications posted after selection cleared |
| Credentials are SecureStore-only and Keystore-decrypted | STATIC | Code path: `lib/storage.ts`, `NotificationBridgeConfig.kt:30-47`; Expo source match | Device upgrade/migration, Keystore invalidation, backup/restore |
| Fixed 40 UYU/USD is active | STATIC | Yes: `lib/format.ts:84-97`; sums `lib/financial-summary.ts:8-23` | Not required to prove arithmetic; a product decision is required to replace it |
| Release keystore exists | ARTIFACT | Yes, path/size/date only | Signing owner attestation; certificate/Play metadata |
| Release APK is signed/valid and matches this source | ARTIFACT | **No** (not checked this run) | `apksigner` by release owner plus reproducible build manifest |
| v2 envelope/batch/receipt protocol interops | LIVE BACKEND | **No** | Approved contract + test service + receipts |
| Capture survives process death/reboot/ack loss | DEVICE | **No** | E10-style 10,000-item native run |
| Listener survives OEM/Doze/force-stop | DEVICE | **No** | Physical OEM matrix |
| Play signing continuity | SIGNING OWNER | **No** | Owner-held Play/upload/app-signing evidence |

## Uncertainties and assigned gate blockers

Every uncertainty below is assigned; none is waived.

| Blocker | Uncertainty | Closing evidence |
| --- | --- | --- |
| **G-GATE** | G1 human approval ledger absent; tree contains pre-G1 implementation; HEAD alone is not reproducible | Signed approval ledger with exact bundle hash/reviewers/expiry; reviewed commit or explicit dirty-tree handoff |
| **G-CONTRACT** | Contract is PROPOSED with 30 open decisions; missing activity/email/attachments/error-details/feature-gate semantics | Closed decisions + approved manifest hash + mobile/backend reviewer records |
| **G-CAPTURE** | No durable commit before send, no revision identity, no receipt validation, no removal/update semantics, no retry policy | Approved design and M03/M04 implementation with E10 evidence |
| **G-CONSENT** | Consent logic is statically explicit but device behavior and migration from older installs are unproven | Device zero-capture test, upgrade test, deselection/queued-evidence decision |
| **G-CREDENTIAL** | No rotation/revocation/enrollment, no 401 pause, no atomic logout, SecureStore-internal coupling | Approved lifecycle design; device Keystore/restore/logout tests |
| **G-SIGN** | Signing custody/Play relationship/source binding unverified; release secrets present in HEAD history | Owner attestation; private exposure assessment; rotation/continuity decision; reproducible build binding |
| **G-DB** | No encrypted outbox, no encryption/key-management design | Approved Room/SQLCipher or payload-encryption design; M03 migration/corruption tests |
| **G-FX** | Fixed 40 UYU/USD and float arithmetic remain | Approved dated-rate contract/ownership; remove implicit conversion; decimal/rounding tests |
| **G-ANDROID** | No device/OEM evidence for binding, Doze, force-stop, reboot, redaction, backup | Physical-device matrix with OS/ABI/OEM recorded; E10 run |
| **G-V2-AUTH** | v2 transport exists but no access token, enrollment, or 401 pause | Provisioning design + live contract test with bearer auth |

## Recommended follow-ups (M01-M09 implications)

- **M01:** Treat the current `contracts/` directory as an untracked import, not an approved baseline. Bind the exact `312c92f8...` manifest to a human G1 ledger, commit it, and supply the bearer `accessToken` path before claiming v2 conformance. Keep the existing `contracts:verify` (`package.json:52`) but record its actual run output.
- **M02:** Keep the SecureStore-only credential design, but decouple it from Expo internals or pin/validate the envelope version on upgrade (`NotificationBridgeConfig.kt:30-47`). Add rotation/revocation/enrollment, 401 pause, atomic logout/account switch, and device tests for migration, Keystore invalidation, and backup/restore. Resolve the committed-secret history finding with the signing owner; do not paste key values into reports.
- **M03:** There is no outbox to extend: design and implement a new encrypted durable queue from scratch. Persist envelope content and identity before any HTTP/scheduling, add delivery states/leases/restart recovery, bounds without silent eviction, and backup exclusion. Choose Room+SQLCipher or reviewed payload encryption and document key wrapping in AndroidKeyStore.
- **M04:** Add durable source/sequence identity and notification-key lifecycle generations; record updates/removals; collapse the duplicate 30-minute (`MainApplication.kt:48-52`) and 15-minute (`NotificationReconciliationWorker.kt:46-55`) health workers into one delivery pipeline with a separate health check; ack only matching receipts.
- **M05:** Replace the fixed FX and float money paths (`lib/format.ts:84-97`, `lib/financial-summary.ts:8-23`) with server decimal strings and dated-rate display. Add correction `expectedVersion`/409 handling. Render delivery pending/held/acknowledged separately from interpretation.
- **M06:** Execute E10 on a physical Android device (10,000 persisted captures across offline, process kill, reboot, ack loss, update+dismiss) and record OS/ABI/OEM, APK hash, and contract hash. No emulator-only claim.
- **M07:** Keep episode/retrieval UI blocked until the contract's episode correction DTOs and open items are approved; do not infer support from the imported schema.
- **M08:** Connector work inherits the same encrypted outbox and consent model; no new provider tokens in storage without an approved lifecycle.
- **M09:** Integrate only reviewed commits, publish APK/source/contract hashes, and keep a rollback that preserves queue/correction data. The current tree cannot be certified because `contracts/`, backup XML, and tests are untracked.

## Limitations

- No APK or AAB was built; no Gradle, lint, typecheck, harness, or dependency install was run.
- No Android device, emulator, or ADB session was used. Listener binding, notification delivery, process death, reboot, Doze, force-stop, Keystore, backup/restore, and OEM behavior are not observed.
- No signing proof is offered. No keystore, certificate, private key, or signing password was opened, printed, hashed, or exported. The existing APK signature was not re-verified in this audit.
- No live backend was contacted; v2 receipt, auth, batch, correction, and decimal behavior are not integration-tested.
- No G1 approval is implied. The imported bundle remains PROPOSED/UNAPPROVED and 30 decisions remain open.
- This report is the only file authored by M00. The 72-entry dirty tree was preserved; no commit, reset, cleanup, or worktree was created.
