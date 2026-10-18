# M00 independent verification

Date: 2026-10-15. Target: BrainIA-Mobile only. Artifact: `docs/reports/v2/mobile-baseline.md`. Independent verifier dispatch: `ctx_bf26e66ac170`, task `task_fddb1976bb91` (M00-V).

**Verdict: M00 accepted-with-conditions.** The static baseline and existing APK claims independently check out. This accepts an investigation deliverable only: G1 remains pending, the v2 contract remains PROPOSED, and no implementation, release, or native-runtime acceptance is granted. The conditions are to retain the historical-verification limits below, correct the minor citation when the report owner next revises it, and close the eight recorded blockers through their required decisions/evidence before approving implementation or claiming readiness.

## Acceptance criteria

The named `docs/BRAIN_AI_V2_EXECUTION_PLAN.md` is absent in this mobile checkout; `rg --files docs` found no task manifest. Rather than access the forbidden backend repository, I requested the exact criteria through Orca. The coordinator's reply to my `orchestration ask` supplied these three authoritative manifest criteria and confirmed PROPOSED contract status/G1 pending. This is coordinator-supplied contract evidence, not independent inspection of the unavailable planning document.

| M00 criterion | Assessment | Exact evidence and limits |
| --- | --- | --- |
| 1. Static findings distinguished from native evidence. | PASS | Baseline lines 9-11 label STATIC, ARTIFACT, and NATIVE RUNTIME; line 11 explicitly says none collected. Lines 100-142 and 148-152 distinguish source inference, proposed design, and future device tests. Independent checks below validate source/artifact claims without treating them as runtime proof. |
| 2. Every mobile uncertainty resolved or assigned a gate blocker. | PASS within audited scope | Baseline lines 102, 116, 122, 132, 140, 142, 152, 167, 171 cover signing, durability, consent, credentials, database encryption, Android/OEM behavior, FX, and unapproved wire contract. The blocker table below confirms their assignment. Exhaustive discovery of every possible future product uncertainty is not asserted. |
| 3. No application edits or native implementation before G1. | UNVERIFIABLE historically; current evidence consistent | Current porcelain matches the baseline's pre-report snapshot exactly after excluding the newly untracked reports directory. There are 50 modified tracked files, no staged paths, and `git diff --quiet -- android/app/src` exits 0. Those facts support unchanged reported state but cannot attribute old dirty edits or exclude edit-and-restore operations. The coordinator states M00 ran read-only. This verification itself writes only this report and runs no implementation/build commands. |

## Independent repository and APK checks

- `git rev-parse HEAD`: `a526b3498fff63df5374c72c11ab09ccc39d13fc`; `git branch --show-current`: `main`. Both match the required baseline.
- Programmatic extraction of the baseline's fenced porcelain block, newline normalization, and comparison with current `git status --porcelain` excluding only `?? docs/reports/` returned `StatusExactExceptReports=True`. `git diff --name-only` counted 50 paths; `git diff --cached --name-only` returned none. Expanded status initially listed only `docs/reports/v2/mobile-baseline.md` under reports; this verification adds the second report.
- `Get-FileHash -Algorithm SHA256 android/app/build/outputs/apk/release/app-release.apk` independently returned `1B6D65B83F1768FF6CB1601EBC06531B7B10F5989AF13F6EA2BC2B083FDDE9A6`, exactly the claimed value. File length is 51,196,192 bytes and LastWriteTimeUtc is 2026-10-03 23:57:12.
- Installed SDK `build-tools/36.0.0/apksigner.bat verify` on that existing APK exited **0**, with no certificate output requested. No build was run.
- Installed SDK `build-tools/36.0.0/aapt.exe dump badging` exited **0**: package `com.brainia.mobile`, versionCode `8`, versionName `1.0.7`, minSdk `24`, targetSdk `36`, compileSdk `36`, native code `arm64-v8a`. Adjacent `output-metadata.json` independently agrees on package/version, release/SINGLE, and schema version 3.
- Signing provenance remains **UNCERTAIN**. `git ls-files -- android/app/release.keystore android/app/debug.keystore` returned no tracked paths. No signing key contents were opened, printed, hashed, exported, or copied intentionally; APK signature validity does not establish signing custody, certificate continuity, or source-to-artifact correspondence. No provenance upgrade is justified by these checks.

## Independent source spot checks

All paths below are relative to this mobile repository. I read actual source rather than relying on the report's conclusions.

| Claim | Evidence | Assessment |
| --- | --- | --- |
| No persistent notification capture queue | `NotificationBridgeService.kt:25,97-127` uses an in-process executor and direct `sendCapture`; `130-189` replays `getActiveNotifications()`; `191-299` sends HTTP and consumes no durable receipt. Searches across `android/app/src`, `lib`, `package.json`, and `android/app/build.gradle` found no application Room/SQLite/SQLCipher capture outbox. Diagnostics persists logs at `NotificationBridgeDiagnostics.kt:61-64`, not recoverable notification payloads. | PASS as a scoped static negative finding, not device proof. WorkManager persistence and the in-memory interaction telemetry queue do not contradict it. |
| Empty/absent selection falls back to name matching | `NotificationBridgeService.kt:301-316`: rejects `brainia`; reads default empty set; requires membership only when nonempty; otherwise matches Santander, Mercado Pago, Google Wallet/walletnfcrel, or billetera. `NotificationBridgeModule.kt:128-154` reports membership and stores explicit empty sets. | PASS. Empty selection cannot be described as capture-off. |
| Native API key stored in ordinary SharedPreferences | `NotificationBridgeModule.kt:25-31` uses `Context.MODE_PRIVATE` and `putString(KEY_API_KEY, ...)`; `NotificationBridgeConfig.kt:4-6` names preferences/key; service `196,265-268` and diagnostics `100-101` read it for headers. JS native SecureStore calls are at `lib/storage.ts:42,59`. | PASS. SecureStore in JS does not encrypt the native duplicate. |
| Fixed exchange rate is active | `lib/format.ts:84,92-103` defines 40, multiplies USD-to-UYU, divides UYU-to-USD, passes unknown currencies through, and maps invalid parsed values to zero. `lib/financial-summary.ts:8-29` excludes report-excluded rows, sums income/expense, and checks conversion presence across all supplied rows. Today line 38 and Money lines 136,264,508,528,536 call these paths. | PASS. USD 10 plus UYU 400 expense gives UYU 800 or USD 20 by this static arithmetic. |
| Background scheduling/backup concerns | `MainApplication.kt:48-51` schedules the named 30-minute worker; `NotificationReconciliationWorker.kt:44-54` schedules a different 15-minute health worker. Manifest line 16 enables backup; installed SecureStore cloud/transfer/legacy XML includes shared preferences generally and excludes only SecureStore. | PASS as static concerns; no timing or OEM backup behavior proved. |

The full cited native source paths are under `android/app/src/main/java/com/brainia/mobile/notification/` (and `MainApplication.kt` in its parent). Cited files and endpoints inspected exist. Range checks confirmed service through 319, module through 154, diagnostics through 152, app-state through 187, settings through 328, format through 103, Today through 38, Money through 536, trust through 73, and the UX audit through 14. The one exception is financial-summary: the cited end line 31 exceeds its actual 30 lines; relevant code is at 8-29. Trust line 73 does render `FIXED_FX_LABEL`. No substantive misquote was found in the four required central claims.

## Gate assignment review

| Blocker | Baseline location | Correct disposition |
| --- | --- | --- |
| G-CONTRACT | 167 | Approved v2 schema/examples, auth, identity, acknowledgements, transition, errors, privacy/retention and FX ownership required; proposed contract cannot certify compatibility. |
| G-CAPTURE | 116 | Event/revision identity, removal semantics, durable acceptance, replay, batching and retry decisions plus later crash/offline/reconnect evidence required. |
| G-CONSENT | 122 | Explicit off/empty migration, source visibility and deselection handling required. |
| G-CREDENTIAL | 132 | Protected native storage, legacy cleanup, identity/account lifecycle, rotation/revocation and native availability evidence required. |
| G-SIGN | 102 | Private authorized custody/continuity attestation and artifact-to-reviewed-source binding required; retain only provenance verdict. |
| G-DB | 140 | Encryption/provider, migration and key lifecycle decisions, on-disk/sidecar and recovery validation required. |
| G-ANDROID | 142 | Listener/OS/OEM, reboot/lock/offline/force-stop, permission/source visibility, OS/ABI device evidence required. |
| G-FX | 152 | Owned dated rates, rounding/missing/stale/unsupported behavior, consistent conversion and calculation evidence required. |

Assignments are appropriate and none is presented as waived. Baseline lines 7 and 167 explicitly withhold implementation approval and exact wire certification; proposed Room/encryption constraints are labeled unapproved at line 138.

## Discrepancies and evidence limitations

| Severity | Finding | Consequence |
| --- | --- | --- |
| Low | `lib/financial-summary.ts:8?31` cites one nonexistent final line; actual relevant range is 8-29 in a 30-line file. Several ranges use literal `?` separators, including F11?F14. | Editorial correction by report owner; no substantive finding changes. This verifier leaves the baseline untouched. |
| Medium, evidence limitation | The execution plan/manifest is unavailable locally, and there is no independently captured pre-M00 content fingerprint or command/access audit supplied. Matching porcelain records path/status, not historical byte identity or process activity. | Criterion 3 and historical assertions of no builds/backend reads cannot be fully independently certified. Coordinator-provided criteria/read-only assertion are explicitly attributed. This is a condition on assurance, not evidence of a violation. |

This verifier accessed only the mobile repository and the Orca skill/CLI and Android SDK locations needed for verification. No backend repository, private signing properties, or key material was intentionally accessed; no APK build, install, native implementation, commit, dependency install, or application write was performed. The unchanged old APK timestamp/hash supports preservation of the existing artifact but cannot rule out an earlier identical rebuild. Git state alone cannot prove that a prior worker never read the backend; that historical claim remains unverifiable from the supplied evidence.

Before writing this report, an aggregate SHA-256 over path/content-hash/mtime records for 83 Git-listed source files in app, components, lib, android/app/src and scripts was `959DF19D7CFE399FA758F02BE1D8E2AAB5D76BD4949437CEF767BE6688EA7D20`. The baseline report SHA-256 was `D0C48D8EC44E5AF91AFFBF6FB00FF7CBE829A1126CFA1A00B8AD0FDF93A061EE`. Both were rechecked after writing and remained unchanged. This covers the verification write window, not the earlier M00 run. Required UI lint/typecheck/harness checks do not apply because no UI/application edits were made; they also would not establish native capture durability or signing provenance.
