# Mobile contract review and M01/M02 gate decision

Review date: 2026-10-18. Repository: `D:/Coding/BrainIA/BrainIA-Mobile` (mobile repository only). Role: mobile API reviewer/coordinator. This review was read-only; the only file authored is this report. No app, native, configuration, dependency, migration, or signing file was edited; no commit, install, APK/AAB build, device run, or backend write was performed.

**Verdict: BLOCKED.** The mobile repository does not contain the G1-approved contract bundle. It contains an older, resealed, unapproved subset whose hash (`312c92f8...`) is not the ledger hash (`666af99f...`), whose wire schemas are materially narrower than the approved bundle, and whose mobile transport rejects an approved `/api/v2/capabilities` response. M02's static credential/consent work is largely sound, but M02 depends on M01, has no device evidence, its required `agent:harness` suite fails, and signing provenance remains an open human gate with plaintext release-signing values still present in HEAD history.

## Revision and dirty state

| Item | Value | Evidence |
| --- | --- | --- |
| HEAD | `a526b3498fff63df5374c72c11ab09ccc39d13fc` | `git rev-parse HEAD` |
| Branch | `main` | `git rev-parse --abbrev-ref HEAD` |
| Dirty entries | **73** = 58 modified tracked + 15 untracked, 0 staged | `git status --porcelain=v1` |
| M00 baseline | 72 entries | `docs/reports/v2/mobile-baseline.md:7` |
| Tree reproducibility | **No.** `lib/api.ts:2` imports an untracked contract tree; the manifest references untracked backup XML. A clean checkout cannot build. | `lib/api.ts:2`, `android/app/src/main/AndroidManifest.xml:16`, `git status --porcelain` |

The count grew by one from M00; the tree remains uncommitted and none of the M01/M02 artifacts are in HEAD.

Commands executed by this reviewer:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run contracts:verify` | 0 | `PASS 382 contract checks; 58 positive/negative schema+semantic fixtures; 7 identity sequences`, manifest `312c92f8...`, `PASS 86 mobile fixture/transport checks` |
| `npx tsc --noEmit` | 0 | No diagnostics |
| `git status --porcelain` / `git diff` / `git diff --no-index` | 0/1 | Used for classification and byte comparison; `--no-index` exit 1 means differences were found |

`npm run lint` and `npm run agent:harness` were **not** run by this reviewer (the harness starts a web server and is an M02 acceptance command owned by the implementer/verifier). Prior M02 evidence records `agent:harness` exit 1 (`docs/reports/v2/M02-r1.md:42`).

## Classification of unapproved changes

This is a **scope classification**, not authorship attribution. The tree is a mixture of M01 work, M02 work, v1 product/UI work, intelligence/telemetry work, localization, and generated graph artifacts. No file was reverted.

### A. M01 contract import scope

| Paths | Status | What it is | Disposition |
| --- | --- | --- | --- |
| `contracts/` (untracked; 15 sealed files + 5 `mobile/` extension files) | Untracked | Contract import; **stale unapproved subset** | Replace sealed members with exact G1 bytes; keep/update extension; commit |
| `lib/api.ts` (modified) | Modified | V2 transport import/wiring at `:2,:29-30,:876,:936`; **also** unrelated v1 pending-transaction/finance product work in the same file | Do not revert; rebase only the v2 lines if needed |
| `lib/domain.ts` (modified) | Modified | `V2Envelope`/`V2QueuedRevision` at `:3-25`; also unrelated `PendingTransaction` types | Do not revert; keep v2 types |
| `package.json` (modified) | Modified | Only `contracts:verify` added at `:52` | Keep; update if verifier changes |

### B. M02 credential/consent/signing scope

| Paths | Status | What it is | Disposition |
| --- | --- | --- | --- |
| `android/app/src/main/java/com/brainia/mobile/notification/NotificationBridgeConfig.kt` | Modified | Keystore/SecureStore reader, consent predicate | Keep; gate on evidence |
| `.../NotificationBridgeDiagnostics.kt` | Modified | Credential reader; sanitized error logging | Keep |
| `.../NotificationBridgeModule.kt` | Modified | Migration bridge, consent state, committed selection writes | Keep |
| `.../NotificationBridgeService.kt` | Modified | Consent gate at send, SecureStore credential read, no body logging | Keep |
| `android/app/build.gradle` | Modified | Env/Gradle-home signing resolution, JUnit, plus pre-existing versionCode/versionName edits | Keep signing resolution; version bump is not M02 |
| `android/app/src/main/AndroidManifest.xml` | Modified | `allowBackup=false`, custom backup rules | Keep |
| `android/gradle.properties` | Modified | Removes four plaintext `BRAINIA_RELEASE_*` definitions; ABI narrowing pre-dates M02 | Keep removal; history/rotation needs owner approval |
| `lib/storage.ts` | Modified | SecureStore-only credentials, migration, recovery, write serialization | Keep |
| `lib/notification-bridge.ts` | Modified | Removes credential arguments; async selection write | Keep |
| `app/settings.tsx` | Modified | Consent UI, pause-all, advanced recovery; mixed with unrelated UI edits | Keep; do not treat whole diff as M02 |
| `android/app/src/main/res/xml/` (2 files, untracked) | Untracked | Backup/extraction exclusion rules | **Must be committed**; manifest references them |
| `android/app/src/test/` (1 file, untracked) | Untracked | Native credential/consent JVM tests | **Must be committed** |

### C. v2-adjacent work outside M01/M02 approval

| Paths | Status | What it is | Disposition |
| --- | --- | --- | --- |
| `app/intelligence/index.tsx`, `app/intelligence/[id].tsx` | Untracked | Intelligence UI; uses v1 (`lib/intelligence.ts:24`) | Not M01/M02; keep, do not claim v2 |
| `components/intelligence/` (3 files) | Untracked | Intelligence UI; `CorrectionPanel.tsx:42` posts to v1 `/classification/teach` | Not M01/M02; corrections remain M05 |
| `app/learning.tsx`, `lib/intelligence.ts`, `components/Telemetry.tsx`, `lib/interaction-telemetry.ts`, `components/layout/NavigationRail.tsx`, `scripts/intelligence-agent-smoke.mjs` | Untracked | Learning/telemetry/navigation prototypes | Not M01/M02; keep separate |
| `app/(tabs)/search.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/review.tsx`, `app/(tabs)/capture.tsx`, `app/(tabs)/financials.tsx`, `app/transaction/[id].tsx`, other screen/component edits | Modified | v1 product UI, pending transactions, review/correction UX, localization | Not M01/M02; no v2 wire use found |

Search for `/api/v2`, `V2Envelope`, `V2QueuedRevision`, `accessToken`, `contractVersion: 2` across `app/`, `components/`, `lib/`, `scripts/` returned only `lib/api.ts:30,936` and `lib/domain.ts:4-22`. There is no UI or native v2 consumer.

### D. Unrelated tooling/generated/localization work

| Paths | Status | Classification |
| --- | --- | --- |
| `graphify-out/` (6 modified + 2 untracked) | Modified/untracked | Generated graph artifacts; not M01/M02 |
| `scripts/*.mjs` (7 modified) | Modified | Smoke/harness/share tooling; not M01/M02 |
| `app.json`, `lib/themes.ts`, `lib/format.ts` locale strings, `app/+html.tsx`, `app/+not-found.tsx`, `lib/grouping.ts`, `lib/hooks.ts`, detail screens | Modified | Version/localization/theme/product work; not M01/M02 |
| `untitled.md` | Untracked | Scratch file; no project role |

## Bundle import status and hash comparison

### G1 authority

The G1 ledger pins the approved bundle identifier:

- `docs/reports/v2/approvals.json:25` -> `666af99fd84d08d43217c380993abcd1540dac66e9a99f618b43a79b2bebfb55`
- `docs/reports/v2/approvals.json:7` -> `owner_approved_b02_r3_with_provisional_capabilities`
- `docs/reports/v2/approvals.json:69` -> mobile API reviewer sign-off `required; no completed mobile API reviewer sign-off supplied`

Independently recomputed:

| Bundle | SHA-256 of `SHA256SUMS.json` | Match G1? |
| --- | --- | --- |
| Backend approved bundle `D:/Coding/BrainIA/BrainIA-Backend/contracts/brain-ai/2.0.0/` | `666AF99FD84D08D43217C380993ABCD1540DAC66E9A99F618B43A79B2BEBFB55` | **Yes** |
| Mobile imported tree `contracts/brain-ai/2.0.0/` | `312C92F8F71C9F98AD3D2D6986E26BD941485332DED516B4052CA14B052ABAD6` | **No** |

The normative document and the approved bundle spec are byte-identical:

- `D:/Coding/BrainIA/BrainIA-Backend/docs/BRAIN_AI_V2_API_CONTRACT_v2.0.0.md` -> `461864A3...17969F1`
- approved `contracts/brain-ai/2.0.0/spec.md` -> `461864A3...17969F1`

The mobile `spec.md` is `401F1977...DC61C` and declares `Specification revision 2.0.0-draft.1` (`contracts/brain-ai/2.0.0/spec.md:3`). The approved revision is `2.0.0-draft.3 (B02-r3)`.

### File-level comparison against the approved manifest

11 of 15 sealed files differ; only the two licenses, `canonical.mjs`, and `seal.mjs` match:

| Status | Files |
| --- | --- |
| Identical (4) | `ajv-formats.LICENSE`, `ajv.LICENSE`, `canonical.mjs`, `seal.mjs` |
| **Different (11)** | `README.md`, `build-bundle.mjs`, `build-fixtures.mjs`, `fixtures.json`, `open-items.json`, `openapi.json`, `schema.json`, `spec.md`, `validator-provenance.json`, `validators.cjs`, `verify.mjs` |

The imported tree self-describes as stale and unapproved:

- `contracts/brain-ai/2.0.0/README.md:3` -> `Status: PROPOSED / UNAPPROVED SUBSET`
- `contracts/brain-ai/2.0.0/open-items.json:3` -> `"approvalReady": false`
- `contracts/brain-ai/2.0.0/open-items.json` -> **30** items with `"status": "open"`
- approved bundle: `openDecisionCount: 0`, 17 resolved decisions, 13 provisional operations (`D:/Coding/BrainIA/BrainIA-Backend/contracts/brain-ai/2.0.0/open-items.json:4-7`)

The mobile verifier is self-referential and cannot establish G1 conformance:

- `contracts/brain-ai/2.0.0/mobile/verify.mjs:13` pins `312c92f8...`, not `666af99f...`.
- `contracts/brain-ai/2.0.0/mobile/verify.mjs:24-30` redirects the sealed verifier's normative-document check to the stale local `spec.md`.
- `contracts/brain-ai/2.0.0/mobile/verify.mjs:68` hardcodes a `Capabilities` fixture with `maxBatchItems: 50` and only two feature flags.
- The five `mobile/` files are not covered by any independent hash pin; the verifier cannot bootstrap its own trust.

The earlier M01 reports are therefore superseded, not supporting evidence:

- `docs/reports/v2/M01-r1.md:8,10` claims the 16 files were imported from a "G1 staging directory" with hash `312c92f8...`.
- `docs/reports/v2/M01-verification.md:13` marks "Imported hash matches G1" as PASS against that same hash.

Those statements were internally consistent for the staging artifact they saw, but that artifact is not the bundle the ledger now approves.

## Contract-vs-mobile feasibility matrix

Approved contract references are from `D:/Coding/BrainIA/BrainIA-Backend/docs/BRAIN_AI_V2_API_CONTRACT_v2.0.0.md`.

| Contract element | Mobile status | Evidence | Concrete gap |
| --- | --- | --- | --- |
| Exact G1 byte import (spec/schema/openapi/fixtures) | **FAIL** | Mobile manifest `312c92f8...`; 11/15 files differ; mobile `spec.md:3` is draft.1 | Re-import exact approved bytes |
| Capabilities shape | **FAIL, hard runtime incompatibility** | Approved: `maxBatchItems:100`, `currencyRegistryVersion`, five false feature gates (`...CONTRACT...:23,125`; approved `schema.json` `Capabilities`). Mobile: `maxBatchItems:50`, no registry version, no gates, `additionalProperties:false` (`contracts/.../schema.json:645-647`; `mobile/verify.mjs:68`) | An approved server response fails mobile validation; `deliverRevision` returns HELD "Unsupported server" (`transport.cjs:110-113`) |
| Operation/schema coverage | **FAIL for import** | Approved: 19 paths / 111 `$defs`. Mobile: 6 paths / 31 `$defs` | Corrections, financial transactions, observation detail/revisions, events, episodes, queries, export, connectors absent from the mobile OpenAPI |
| Envelope identity (`deliveryId`, source instance/key, producer revision/sequence, fingerprint) | Partial, JS only | `lib/domain.ts:4-19`; no Kotlin references | Native capture still sends `contractVersion:1` and notification-key identity (`NotificationBridgeService.kt:241,254`) |
| Single observation + receipts | JS only | `transport.cjs:90-94,117-121`; `lib/api.ts:936` | No screen/native caller; native accepts any 2xx without parsing a receipt (`NotificationBridgeService.kt:277-283`) |
| Batch 1..100, ordered per-item results | Partial | `transport.cjs:95-99`; mobile schema caps at 50 | No native batching or outbox; limit is wrong |
| 401 pause / 403 operation pause / 409/422 attention | **FAIL** | Approved: `...CONTRACT...:15,159`; mobile `deliverRevision` only maps `unsupported_contract` to HELD, everything else to PENDING (`transport.cjs:119-121`) | 401/403 retry as PENDING instead of blocked-auth/held; no pause state in the client |
| Bearer auth (`Authorization: Bearer <opaque-device-token>`) | **FAIL / unprovisioned** | `lib/api.ts:29-30,936`; no `accessToken` is passed by `lib/app-state.tsx:145-149` | Transport sends no auth header; every v2 call would 401. No enrollment/rotation/revocation path |
| Error object / details | Partial | `transport.cjs:80-89` validates declared error shape | No `error.details` union in the mobile schema; no UI handling for field/conflict/retry details |
| Decimal money and dated FX | **FAIL** | Fixed `UYU_PER_USD = 40` and float conversion (`lib/format.ts:84-96`); summary converts (`lib/financial-summary.ts:16`); approved contract forbids implicit/fixed rates (`...CONTRACT...:163`) | M05 work; no decimal-string money path; no rate id/provider/asOf |
| Corrections with `expectedVersion` | **FAIL** | `components/intelligence/CorrectionPanel.tsx:42` posts v1 `/classification/teach`; no 409 handling | v2 corrections absent; M05 |
| Capability/unknown-enum gating in UI | Absent | No v2 consumer outside `lib/api.ts`/`lib/domain.ts` | Unknown enums cannot be rendered safely; no feature-gate UI |
| F11 durable capture | **Missing** | No outbox/DB dependency (`package.json`); direct v1 send (`NotificationBridgeService.kt:254`); active-snapshot replay only | M03/M04; contract requires durable commit before network |
| F12 consent + single credential store | **Static pass for v1 legacy** | `NotificationBridgeConfig.kt:61-62`; `Module.kt:88-89`; `storage.ts:55-99` | v2 device credential/enrollment, rotation, 401 pause, atomic logout, device proof still open |
| F13 signing provenance | **Unverified / blocked** | `build.gradle:7-14,118-121`; HEAD `android/gradle.properties:65-68` contains plaintext release signing values (not reproduced) | No certificate/Play attestation, no `apksigner`, no source-to-APK binding |
| F14 dated explicit FX | **Missing** | `lib/format.ts:84,92-96`; `lib/financial-summary.ts:16` | M05; cannot claim contract conformance |

## M01 acceptance review

Exact criteria from `D:/Coding/BrainIA/BrainIA-Backend/docs/BRAIN_AI_V2_TASK_SPECIFICATIONS.md:269-271`.

| M01 criterion | Status | Evidence file:line |
| --- | --- | --- |
| Imported hash matches G1 | **FAIL** | Mobile manifest `312c92f8...` (`contracts/brain-ai/2.0.0/SHA256SUMS.json`; `mobile/verify.mjs:13`) vs ledger `666af99f...` (`D:/.../docs/reports/v2/approvals.json:25`). 11/15 sealed files differ; mobile `spec.md:3` is draft.1; `open-items.json:3` is `approvalReady:false` with 30 open decisions. Prior PASS claims used the stale hash (`docs/reports/v2/M01-r1.md:10`; `M01-verification.md:13`). |
| Cross-language positive/negative fixtures pass | **FAIL against G1; local mechanism only** | `npm run contracts:verify` exits 0 with 382 checks / 86 mobile checks, but against the stale fixtures and stale `Capabilities` fixture (`mobile/verify.mjs:68`). The approved bundle's 1,775,846-byte `fixtures.json`, 111-def schema, and 19-path OpenAPI are not exercised. A green local run does not satisfy the G1 fixture obligation (`...CONTRACT...:113`). |
| No runtime backend filesystem dependency or writes | **PASS** | `lib/api.ts:2` imports the local tree; `mobile/transport.cjs:1` and `mobile/runtime.cjs:3` require only local files; no `fs`/backend path in runtime transport or runtime. `package.json:52` points at the local verifier. The verifier itself uses `fs` but is a development script, not app runtime. |

**M01 result: BLOCKED.** Criterion 1 fails outright; criterion 2 fails its evidentiary basis; criterion 3 passes.

## M02 acceptance review

Exact criteria from `D:/Coding/BrainIA/BrainIA-Backend/docs/BRAIN_AI_V2_TASK_SPECIFICATIONS.md:366-369`; M02 depends on M01.

| M02 criterion | Status | Evidence file:line |
| --- | --- | --- |
| Empty selection captures zero notifications | **PASS static; device unverified** | Predicate is `configured && selected.contains(packageName)` (`NotificationBridgeConfig.kt:61-62`); status distinguishes absent/empty/selected (`Module.kt:88-89`); send path rechecks (`NotificationBridgeService.kt:194`); posted/reconcile paths recheck (`:102,153`); JVM fixtures cover finance apps, empty set, last-app removal (`NotificationBridgeSecurityTest.kt:52-79`). No device run: `M02-r1.md:45` records 0 ADB devices. |
| No plaintext key in prefs/logs/backup | **PASS static for capture credentials; BLOCKED for signing secrets and reproducibility** | No native credential writer remains (`Module.kt:26-31`); capture/diagnostics read only the SecureStore envelope (`NotificationBridgeConfig.kt:33-47`; `NotificationBridgeService.kt:264-271`); rejection bodies and exception text are not logged/persisted (`NotificationBridgeService.kt:277-283`; `NotificationBridgeDiagnostics.kt:108,130`). Backup disabled (`AndroidManifest.xml:16`) with all-domain exclusions (`brainia_backup_rules.xml:3-11`; `brainia_data_extraction_rules.xml:3-24`). **But** the rule files are untracked, and HEAD `android/gradle.properties:65-68` still contains four plaintext release-signing values (not reproduced here). |
| Secure migration preserves session or prompts visible reauth | **PASS static; device unverified** | Encrypted JS value wins, native-only value imported, rewritten through SecureStore, verified by native reader, then removed (`lib/storage.ts:66-99`; `Module.kt:44-67`). Failure shows a visible Spanish recovery alert and blocks automatic overwrite (`lib/storage.ts:18-29,92-96,125`; `app/settings.tsx:292-294`). Writes serialized and deletion ordered (`lib/storage.ts:101-160`). M02 verification notes failed migration can retain legacy plaintext until retry (`M02-verification.md:28,43`). |
| Rotation/history rewrite only with human approval | **PASS: none performed; exposure unresolved** | `M02-r1.md:32` records signing ownership as BLOCKED and states no rotation/rewrite was done. HEAD history still contains the exposed values. |
| Signing provenance (required step 4) | **BLOCKED** | Signing values resolve from env then user Gradle home (`build.gradle:7-14,118-121`); release uses a separate config (`:138`); no tracked keystore (`git ls-files`); `android/app/release.keystore` exists untracked. No Play/certificate attestation, no `apksigner` run, no reproducible source-to-APK binding. |

**M02 result: BLOCKED at the gate, static implementation largely acceptable.** The static credential/consent design meets the intent of the four criteria. It cannot be signed off because M01 is blocked, the backup/test artifacts are untracked, device evidence is absent, the required full harness fails, and signing exposure is unresolved.

## Reviewer decision

**BLOCKED** for M01 and M02.

Sign-off cannot be given because the artifact under review is not the approved artifact. This is not a formatting or documentation discrepancy: the mobile transport would reject a conforming approved server at the first `/api/v2/capabilities` call, so any green test run in this tree is evidence about a different contract.

### Blocking items (exact)

1. **Wrong contract artifact.** `contracts/brain-ai/2.0.0/SHA256SUMS.json` hashes to `312c92f8...`, not G1 `666af99f...`; 11/15 sealed files differ.
2. **Stale unapproved specification.** Mobile `spec.md:3` is `2.0.0-draft.1`; `open-items.json:3` is `approvalReady:false` with 30 open decisions. The approved bundle has 0 open decisions and 13 provisionally authorized operations.
3. **Hard wire incompatibility.** Mobile `Capabilities` requires `maxBatchItems:50`, omits `currencyRegistryVersion`, omits the five feature gates, and forbids additional properties; approved responses use `100` and include those fields. Result: HELD/unsupported against a correct server.
4. **Contract surface is truncated.** Mobile OpenAPI has 6 paths / 31 schemas; approved has 19 paths / 111 schemas. The import cannot validate corrections, financial transactions, observation detail/revisions, events, episodes, queries, export, or connectors.
5. **Verifier is self-referential.** `mobile/verify.mjs:13` pins the stale manifest, `:24-30` substitutes the stale spec for the normative document, and `:68` hardcodes the stale capabilities. The mobile extension files are not independently hash-pinned.
6. **Required M02 evidence is incomplete.** `agent:harness` exit 1 (`M02-r1.md:42`); no connected device (`M02-r1.md:45`); backup XML and native tests are untracked, so a clean checkout cannot reproduce the claimed build.
7. **Signing provenance unresolved.** Plaintext release-signing values remain in HEAD `android/gradle.properties:65-68`; no owner attestation, certificate/Play continuity, or `apksigner` evidence. Removing the working-tree lines does not remediate history.
8. **No v2 auth provisioning or 401 pause.** `lib/api.ts:936` constructs the transport, but `lib/app-state.tsx:145-149` never supplies `accessToken`; `transport.cjs:119-121` maps 401/403 to PENDING rather than blocked-auth/held.

### What must be rebased or reverted before M01/M02

Nothing should be reverted wholesale. The following are the exact reconciliation actions:

- **Replace** the 15 sealed files in `contracts/brain-ai/2.0.0/` with the exact approved bytes. Do not hand-edit schema/OpenAPI/spec/fixtures.
- **Keep** the five `mobile/` extension files, but rewrite them against the approved schema/OpenAPI. If a narrower operation allowlist is intentional, enforce it in code; do not truncate the contract's `schema.json`/`openapi.json`.
- **Keep** the v2 lines in `lib/api.ts:2,29-30,876,936` and `lib/domain.ts:3-25`. The surrounding pending-transaction code is unrelated product work and must not be reverted by a `git checkout` of these files.
- **Mark superseded** `docs/reports/v2/M01-r1.md` and `docs/reports/v2/M01-verification.md`; their PASS is against `312c92f8...` and must not be carried forward as G1 evidence.
- **Commit** `contracts/`, `android/app/src/main/res/xml/`, and `android/app/src/test/` in the M01/M02 change set (with owner approval) so the tree is reproducible.
- **Commit** the `android/gradle.properties` removal of the four release-signing definitions. Rotation or history rewrite remains blocked pending explicit human approval.
- **Do not** delete or revert `app/intelligence/`, `components/intelligence/`, `lib/intelligence.ts`, telemetry, navigation-rail, financial-pending, localization, or graphify work. It is outside M01/M02 and must simply not be claimed as approved v2 functionality.

## Next actions for the mobile coordinator

1. **Freeze v2 edits** until the contract re-import lands. Do not let M03/M05 build on the stale `mobile/` schemas.
2. **Re-import exact G1 bytes** (copy only; no regeneration):
   - Source: `D:/Coding/BrainIA/BrainIA-Backend/contracts/brain-ai/2.0.0/` (exclude the absence of `mobile/`; mobile extension stays local).
   - Destination: `contracts/brain-ai/2.0.0/`.
   - Verify: `(Get-FileHash contracts/brain-ai/2.0.0/SHA256SUMS.json -Algorithm SHA256).Hash` must equal `666AF99FD84D08D43217C380993ABCD1540DAC66E9A99F618B43A79B2BEBFB55`, then hash all 15 members against the manifest.
3. **Update `contracts/brain-ai/2.0.0/mobile/verify.mjs`:**
   - pin `666af99f...`;
   - remove the `externalSpec` substitution and verify the vendored `spec.md` against the approved hash;
   - remove the hardcoded capability object at `:68`; build the positive fixture from the approved schema/`fixtures.json`;
   - assert 111 `$defs`, 19 paths, `maxBatchItems:100`, `currencyRegistryVersion`, and all five feature gates.
4. **Add a separate hash pin** for the five `mobile/` files (for example `mobile/SHA256SUMS.json`) and make `contracts:verify` check it before executing the transport. This closes the bootstrap-trust gap.
5. **Fix `contracts/brain-ai/2.0.0/mobile/transport.cjs`:**
   - validate `Capabilities` against the approved shape;
   - map 401 to `HELD`/`BLOCKED_AUTH` and 403 to `HELD`, not `PENDING`;
   - keep location/email/activity gate holds;
   - keep the explicit allowlist in code if provisional operations must remain implementation-blocked.
6. **Provision v2 auth** through the approved out-of-band device-credential path, or make the queue hold with reason `auth_missing` until a token exists. Never send an unauthenticated v2 request. Track as G-V2-AUTH.
7. **Commit the reproducibility set**: `contracts/`, `android/app/src/main/res/xml/brainia_backup_rules.xml`, `android/app/src/main/res/xml/brainia_data_extraction_rules.xml`, `android/app/src/test/java/com/brainia/mobile/notification/NotificationBridgeSecurityTest.kt`, and the `gradle.properties` removal. Review the mixed `lib/api.ts`, `lib/domain.ts`, `app/settings.tsx`, and `build.gradle` diffs hunk-by-hunk; do not use whole-file checkout.
8. **Re-run the M01 gate commands** in order: `npm run contracts:verify`, `npx tsc --noEmit`, `npm run lint`. Record exact exit codes and the new manifest hash.
9. **Run the M02 gate commands**: `npm run agent:harness` (must exit 0; the transaction-edit timeout at `M02-r1.md:42` must be fixed or explicitly scoped), `npm run contracts:verify`, and `android/: .\gradlew.bat :app:testDebugUnitTest --rerun`.
10. **Obtain device and signing evidence** before M02 sign-off:
    - physical Android upgrade/migration, empty-selection zero-capture, restart/background, backup/restore, Keystore invalidation;
    - `connectedDebugAndroidTest` on an attached device (the previous exit 0 was build-only);
    - signing-owner attestation for certificate continuity and Play upload/app-signing relationship, plus `apksigner verify --print-certs` on a reviewed artifact. Do not rotate or rewrite history without explicit approval.
11. **Have an independent verifier** re-run the above on the re-imported tree and update `docs/reports/v2/M01-verification.md` / `M02-verification.md` with the new hash. This reviewer's report can then be re-issued as `SIGNED_OFF_WITH_CONDITIONS` only if items 1-8 are closed.

## Limitations

- No Android device, emulator, or ADB session was used. Listener binding, process death, reboot, Doze/force-stop, Keystore, backup/restore, and OEM behavior are not observed.
- No APK/AAB was built, and no `apksigner`, certificate, Play, or signing-material inspection was performed. No key material was opened or reproduced.
- No live backend or approved test service was contacted. v2 receipts, auth, batch, correction, decimal, and capability behavior are not integration-tested.
- This reviewer ran only `npm run contracts:verify` and `npx tsc --noEmit`. `npm run lint`, `npm run agent:harness`, Gradle tests, and device tests are reported from prior worker evidence, not re-executed here.
- The dirty tree prevents complete historical attribution. The classification above is by scope and path; it does not prove who authored each hunk or that no edit-and-restore occurred.
- No G1 approval is inferred beyond the ledger entry. The approved bundle still self-labels `PROPOSED REVISION PENDING REVIEW` and `approvalReady:false`; the binding approval is the ledger hash, not the artifact's self-description. This review supplies no approval until the blockers above are closed.
