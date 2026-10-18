# M01 independent verification (revision 2)

Date: 2026-10-18. Repository: `D:/Coding/BrainIA/BrainIA-Mobile`, branch `main`, HEAD `a526b3498fff63df5374c72c11ab09ccc39d13fc`, dirty tree (73 porcelain entries, unchanged from `docs/reports/v2/mobile-contract-review.md`). Verifier: independent of the M01 implementer; read-only. Implementer artifact: `docs/reports/v2/M01-r1.md` (revised 2026-10-18 11:36). This report **supersedes** the 2026-10-15 `M01-verification.md`, which validated the stale `312c92f8…` staging subset and must not be used as evidence.

**Verdict: M01 accepted-with-conditions (updated 2026-10-18 after the M01-r2/M02-r3 follow-up; see addendum §9).** The approved G1 bytes are now imported exactly: the mobile manifest recomputes to `666af99f…bfb55`, all 15 sealed members match the backend bundle byte-for-byte, `spec.md` is the approved `2.0.0-draft.3` normative document, the extension is independently pinned, and `contracts:verify` passes 912 sealed + 204 mobile checks. No hash mismatch, unapproved contract surface, unauthenticated observation send, backend filesystem dependency, or app/native scope creep was found. Conditions are evidence/behavioral, not byte-integrity: the offline-at-capabilities state contradicts the implementer's own table, the extension trust root is local, the repo still cannot reproduce the tree from a clean checkout, and the G1 ledger still records the mobile reviewer sign-off as outstanding.

Scope of this verification: offline JavaScript contract layer, manifest/spec bytes, extension, transport state machine, and repository scope. No live backend, device, native capture, APK/AAB, or Metro bundle execution was performed.

## 1. Hash verification (node:crypto, independent of the mobile verifier)

| Item | Recomputed value | Expected | Match |
| --- | --- | --- | --- |
| `contracts/brain-ai/2.0.0/SHA256SUMS.json` | `666af99fd84d08d43217c380993abcd1540dac66e9a99f618b43a79b2bebfb55` | G1 ledger `approvals.json` (v3, `gates[G1].artifacts.bundle_manifest.sha256`) | **Yes** |
| Manifest bytes vs backend bundle | byte-identical (`Buffer.equals`) | `D:/Coding/BrainIA/BrainIA-Backend/contracts/brain-ai/2.0.0/SHA256SUMS.json` | **Yes** |
| Sealed members | 15 / 15 recomputed, each equals its manifest entry, backend file and manifest entry | manifest | **Yes** |
| Bundle root set | 16 files = 15 sealed + `SHA256SUMS.json`; only extra directory is `mobile/` | no unsealed root files | **Yes** |
| `spec.md` | `461864a300fd3eb6a611f6f911ef5d111a8ba4e2e013b458858cf08ed31769f1` | ledger spec + bundle spec + normative document | **Yes** |
| `spec.md` vs `D:/Coding/BrainIA/BrainIA-Backend/docs/BRAIN_AI_V2_API_CONTRACT_v2.0.0.md` | byte-identical | normative document | **Yes** |
| Spec revision | `2.0.0-draft.3 (B02-r3)`; zero occurrences of `draft.1` | approved revision | **Yes** |

Per-member SHA-256 (all independently recomputed; all equal the backend bundle):

| Sealed member | SHA-256 |
| --- | --- |
| `README.md` | `57d6743a99881bb988513fc58c1004efbcf3751f0b620b6dce837c88772f6af9` |
| `ajv-formats.LICENSE` | `9df3bb69929a3b650ed73b3bfa1756725aaff0ac296461605753547004eafeaf` |
| `ajv.LICENSE` | `a05350a88e318e4f5f2c2a1ff1e2e88daa4dd38e6e78b71cccae422bdc762cc3` |
| `build-bundle.mjs` | `af4650faa553585a3c85a740e728fd5f217b2d6f31ef9200b4cf44a764d3b208` |
| `build-fixtures.mjs` | `1b25ba03234e0ae442c0b191930b178bd79bc4d615d02e4f56f002eae94ce4a5` |
| `canonical.mjs` | `6be30ad2aa4c48ce3bcbe3f76eb9677592a19c9058e00053116b36c48951c61a` |
| `fixtures.json` | `cfc5b5b063438cb5733de445e971249f6f28b3cfbdaebe5e526b4211c9b1b541` |
| `open-items.json` | `a9bbd64880170914b1e98bac80abce77da21cf66a65b303f8716c158fd5e7cf5` |
| `openapi.json` | `40c4ea56ac31246863811712e555541e195e76c27b2a930ad566ce6f2610cc2c` |
| `schema.json` | `5654550269532eb1515c0633d55515813cece9a096a6722c7a541807351e7113` |
| `seal.mjs` | `9618ae503a31ba6bcd1143409f7d687290ff139161f9e55ec65c7ad1d991ad1b` |
| `spec.md` | `461864a300fd3eb6a611f6f911ef5d111a8ba4e2e013b458858cf08ed31769f1` |
| `validator-provenance.json` | `f75145fbfe85ff53ec58db005ba92fa05bc340bc88ecf03aba4cdb3aebc4d171` |
| `validators.cjs` | `f051ad351d0105e5ef5c19dc54946b482c1667872c756041596765fed9f960db` |
| `verify.mjs` | `fa1617d25bd201af472e03cf49be366250da45038b9783efe647375f7bdc0203` |

Ledger cross-check (`D:/Coding/BrainIA/BrainIA-Backend/docs/reports/v2/approvals.json`, `ledger_version: 3`): G1 status `owner_approved_b02_r3_with_provisional_capabilities`, `open_decision_count: 0`, 30 owner decisions resolved, 13 provisional operations, `published_operations_are_not_automatically_approved: true`, `mobile_api_review_status: required; no completed mobile API reviewer sign-off supplied`. `open-items.json` in the bundle agrees on 0 open decisions and 13 `schema_published_pending_review` items with `implementationBlocked: true`. The artifact still self-labels `PROPOSED_REVISION_PENDING_REVIEW` / `approvalReady: false`; the binding authority remains the ledger hash, not the self-description.

## 2. Mobile extension and conformance surface

Extension directory `contracts/brain-ai/2.0.0/mobile/` contains exactly 6 files. `mobile/SHA256SUMS.json` pins the 5 code files, and the directory-set assertion rejects any extra unpinned file:

| Extension member | SHA-256 | Pinned by `mobile/SHA256SUMS.json` |
| --- | --- | --- |
| `runtime.cjs` | `92d5276f40790c68b83f113b7a4190cc76bb7513a842359d5088a9cdd0352733` | Yes |
| `runtime.d.cts` | `52a7d2acd04d5730f02cb5e63c2e0a176eb40a605db9e0e9462724ffd1b15060` | Yes |
| `transport.cjs` | `ae12aaf502d1d43faf214f8dfc92c87330a6ad37bbb79216e36f6d42fae5c397` | Yes |
| `transport.d.cts` | `b87478824d12851ddf2d88ba288ad2980514bbf99e1cc22f4c61cdf4e0e920fc` | Yes |
| `verify.mjs` | `a468d8815f53c5e50680d3523a259ffa48e2f2a9910a0450d6f99ff410c9e4d8` | Yes |
| `SHA256SUMS.json` | not self-hashed (local trust root) | — |

Surface inspection (all read from the sealed files; no local schema copy or override exists):

- `schema.json`: **111** `$defs`; `openapi.json`: **19** paths — same counts as the backend bundle and asserted by the mobile verifier before it executes any extension code.
- `Capabilities`: `maxBatchItems.const = 100`, `currencyRegistryVersion.const = "ISO4217-CLDR-45"`, `apiVersion` const 2.0.0, `captureVersions: [1,2]`, `maxItemBytes: 65536`, `maxBatchBytes: 1048576`, `additionalProperties: false`.
- Feature gates: `observationRevisions = true`, `decimalFinance = true`, and `email`, `activity`, `location`, `episodes`, `connectors` all `false`, all required.
- No narrowing: `transport.cjs` resolves operations from the sealed `openapi.json`; the only operation it refuses is the contract's intentionally excluded `POST /api/v2/deletions`, and unknown paths/fields/query parameters fail closed before fetch. It does not add an allowlist that hides approved paths.
- No widening: `runtime.cjs` delegates schema validation to the sealed `validators.cjs`; its local `semantic()` body is line-for-line the sealed verifier's semantic rules (identical limits, fingerprint recomputation, decimal comparisons, cross-field checks). No alternate schema, no relaxed `additionalProperties`.
- The 13 provisional operations are published and therefore reachable through the generic `request()`; no M01 caller implements them, consistent with the ledger's "cannot be implemented from this record". A code-level `implementationBlocked` allowlist is still future work (condition C4).
- `transport.d.cts` imports the app type `../../../../lib/domain` for `V2QueuedRevision` (type-only, mobile repository only). This is a layering inversion, not a backend dependency (condition C5).

## 3. Transport state matrix (independent probe, not only the shipped test)

Probe: the sealed approved fixtures (`capabilities-resolved`, `new-notification`, accepted acknowledgement) driven through the repository's `mobile/transport.cjs` with a recording fetcher. Results:

| Condition | Observed state | Reason | Requests sent |
| --- | --- | --- | --- |
| No token: `undefined` / `null` / `''` / `async () => null` | `BLOCKED_AUTH` | `auth_missing` | **0** (no network at all) |
| `GET /capabilities` 401 (valid body) | `BLOCKED_AUTH` | `blocked_auth` | 1 (capabilities only) |
| 401 bodyless | `BLOCKED_AUTH` | `blocked_auth` | 1 |
| `POST /observations` 401 | `BLOCKED_AUTH` | `blocked_auth` | 2 |
| 403 `forbidden` | `HELD` | `forbidden` | 2 |
| Unsupported capabilities (old batch limit, `email:true`, stale registry, incomplete) | `HELD` | `unsupported_or_unavailable_capabilities` | 1 (no observation POST) |
| Advertised gate false for `activity` / `email` envelope | `HELD` | `capabilities.featureGates` | 1 (no observation POST) |
| 422 `unsupported_contract` (retired/unsupported contract) | `HELD` | `unsupported_contract` | 2 |
| 409 `identity_conflict` | `PENDING` | `identity_conflict` | 2 |
| 422 `version_conflict` | `PENDING` | `version_conflict` | 2 |
| 429 / 503 | `PENDING` | `rate_limited` / `unavailable` | 2 |
| Offline during `POST /observations` | `PENDING` | `invalid_or_missing_acknowledgement` | 2 |
| **Offline during `GET /capabilities`** | **`HELD`** | `unsupported_or_unavailable_capabilities` | 1 |
| 200 or 201 receipt matching `deliveryId`, `producerRevisionId`, `contentFingerprint` | `ACKNOWLEDGED` | — | 2 |
| 202, 200 without valid receipt, mismatched fingerprint, malformed 2xx | `PENDING` | `invalid_or_missing_acknowledgement` | 2 |
| `POST /api/v2/deletions` (excluded operation) | rejected before fetch | `Operation blocked by G1 contract` | 0 |
| Unexpected request field (`ownerId`) | rejected before fetch | `Invalid v2 contract` | 0 |

Authentication: every operation whose OpenAPI `security` is absent inherits the global `deviceBearer` requirement; the transport throws `auth_missing` **before** calling the fetcher when no token resolves. The only bearerless operation in the approved contract is `GET /api/v2/connectors/email/callback` (`security: []`, spec.md:144, "no bearer"), the server-side OAuth callback. A probe confirmed it is the single path that can be invoked without a token and that it makes a network call; no mobile code calls it, and it cannot deliver observations. **No unauthenticated observation/queue send path exists.**

Two state discrepancies:

1. **Defect (documentation + semantics):** offline during the capabilities call returns `HELD`, not `PENDING`. `M01-r1.md:82` lists "offline" under `PENDING`/retry-allowed, and its own test at `mobile/verify.mjs:296-300` asserts `HELD`. The queue bytes are preserved and no observation is attempted, so there is no data-safety or auth impact, but a transient network outage is reported as `unsupported_or_unavailable_capabilities`, which reads like a server incompatibility and could park a revision until manual action. Condition C1.
2. `M01-r1.md:83-84` describes acknowledgement matching accurately; the `202` and no-body cases are covered by the independent probe and stay `PENDING`.

## 4. Command exits

| Command | Exit | Observed output |
| --- | --- | --- |
| `npm run contracts:verify` | **0** | `PASS 912 contract checks; 152 positive/negative schema+semantic fixtures; 7 identity sequences.` then `PASS 204 mobile conformance checks; approved manifest 666af99f…bfb55; 15 sealed files; 5 pinned extension files; 111 $defs; 19 OpenAPI paths.` |
| `npm run lint` | **0** | `expo lint`, no diagnostics |
| `npm run typecheck` | **0** | `tsc --noEmit`, no diagnostics |
| `npm run agent:harness` | **1** | Static typecheck/lint pass; `REVIEW_LOADING_OK`, `REVIEW_EMPTY_OK`, `REVIEW_EDITING_OK`, `REVIEW_AGENT_SMOKE_OK`, `CAPTURE_TRANSFER_AGENT_SMOKE_OK`; then `transaction-edit-agent-smoke.mjs:66` times out after 120 s waiting for `getByText('Tipo de movimiento')` to hide. Expo was stopped (port 8090 not listening after the run). |

Fail-closed mutation tests were run on a copy at `C:/Users/germa/AppData/Local/Temp/opencode/m01-mutation/2.0.0` (never on the repository). All returned exit **1**:

| Mutation | Failure |
| --- | --- |
| One-bit XOR of `README.md` | `AssertionError` `sealed bytes README.md`; recomputed `7ed1a2d4…`, expected `57d6743a…` |
| One-bit XOR of `fixtures.json` | `AssertionError` `sealed bytes fixtures.json` |
| Added unsealed root file `EXTRA.txt` | `AssertionError: no unsealed files in the bundle root` |
| One-bit XOR of `mobile/transport.cjs` | `AssertionError: extension bytes transport.cjs` |

`agent:harness` failure classification: **pre-existing and outside M01**, not counted for or against M01. The same timeout is recorded at `docs/reports/v2/M02-r1.md:42`; `scripts/transaction-edit-agent-smoke.mjs` and `scripts/agent-harness.mjs` have last-write times of 2026-09-23, and `app/transaction/[id].tsx` of 2026-10-04, all before this revision. The failing screen/script contains no v2 code. M02's harness gate remains red.

## 5. Runtime dependency and writes

- `lib/api.ts:2` imports `../contracts/brain-ai/2.0.0/mobile/transport.cjs` from the local tree only; there is no `BrainIA-Backend` path, no `fs`, and no cross-repository import in app runtime.
- `mobile/transport.cjs:1-2` requires only `./runtime.cjs` and `../openapi.json`; `mobile/runtime.cjs:4` requires only `../validators.cjs`. Neither module imports `fs`, `path`, `node:*`, or any backend path, and neither writes anywhere.
- `mobile/verify.mjs` is a development verifier: it uses `node:fs` read-only, filters only `mobile/` out of the sealed root-set check, and redirects the sealed verifier's repository-relative normative-document read to the already-pinned local `spec.md` (`verify.mjs:83-92`, restored in `finally`). Both hooks target repository-local paths; no backend file is read or written. No backend write path exists anywhere in `contracts/` or `lib/`.
- Token source: `lib/api.ts:32,943` reads `brainia_mobile.v2AccessToken` through `readStoredValue` **per request**; `config.accessToken` wins when supplied. Missing/empty/async-empty tokens produced `BLOCKED_AUTH` with zero network calls.

## 6. Scope

Path evidence (last-write times plus the 11:27 review baseline `docs/reports/v2/mobile-contract-review.md`):

| Path group | Last write | Assessment |
| --- | --- | --- |
| `contracts/brain-ai/2.0.0/*` (sealed) | 2026-10-18 00:25 | Approved import, within M01 reservation |
| `contracts/brain-ai/2.0.0/mobile/*` | 2026-10-18 11:29–11:36 | Extension rewrite, within reservation |
| `lib/api.ts` | 2026-10-18 11:29:46 | Within reservation; diff vs HEAD adds the v2 import, `V2_ACCESS_TOKEN_KEY`, `accessToken` config, `v2: createV2Transport(...)` provider, plus pre-existing v1 pending-transaction/finance work already present in the 11:27 review |
| `lib/domain.ts` | 2026-10-18 11:29:41 | Within reservation; `V2Envelope`, `V2QueuedRevision`, `V2Capabilities` |
| `docs/reports/v2/M01-r1.md` | 2026-10-18 11:36:50 | Implementer report |
| `app/`, `components/`, `android/`, `scripts/`, `package.json` | newest 2026-10-15, package.json 2026-10-15 13:56 | **Not touched by this revision** |

Porcelain count is 73, identical to the review's baseline; no new untracked file appeared in the repository during this verification (`expo-env.d.ts` regenerated at 11:32 is gitignored). **No app/native/package scope creep was introduced by the M01 revision.** The limitation that remains is attribution, not path scope: because the tree is uncommitted and no pre-M01 snapshot of `lib/api.ts`/`lib/domain.ts` exists, the verifier cannot byte-prove that only the v2 hunks changed inside those two already-dirty reserved files.

## 7. Conditions

M01 can close on bytes and offline conformance, subject to:

1. **C1 — Offline capability failure state.** Reconcile `mobile/transport.cjs:63-71` / `verify.mjs:296-300` with `M01-r1.md:82`: either map network/offline errors during `GET /capabilities` to `PENDING` (retry allowed) or document and test `HELD` with a network-specific reason. Current behavior is safe but misclassifies a transient outage as an unsupported server and contradicts the implementer report.
2. **C2 — Extension trust anchor.** `mobile/SHA256SUMS.json` is a local, unpinned trust root, and `SHA256SUMS.json` is not self-hashed. Record the five extension hashes (or the sums-file hash) in the G1 ledger/CI so a coordinated edit of verifier + sums is detectable. The sealed manifest is externally anchored; the extension is not.
3. **C3 — Reproducibility.** `contracts/` is still untracked (`?? contracts/`), as are `android/app/src/main/res/xml/*` and `android/app/src/test/.../NotificationBridgeSecurityTest.kt`. A clean checkout cannot reproduce this verified tree until they are committed under owner approval.
4. **C4 — Provisional operations.** The transport permits the 13 `implementationBlocked` provisional operations through `request()` because it resolves the published OpenAPI. No caller exists today; M02/M05 must not implement them without a new approval, and should add an explicit allowlist if the ledger's "cannot be implemented from this record" must be enforced in code.
5. **C5 — Typings layering.** `mobile/transport.d.cts:1` imports `lib/domain` from inside the contract extension. Type-only and repository-local, but it couples the contract surface to app code; prefer a self-contained type in the extension.
6. **C6 — Ledger sign-off.** G1 still records `mobile_api_review_status: required; no completed mobile API reviewer sign-off supplied` and `evidence: null`. The approver must attach this verification (and the implementer report) to the ledger before downstream mobile work treats G1 as reviewed.

Remaining M02 conditions (unchanged, from `M02-r1.md` and the 11:27 review): `agent:harness` hard gate red (pre-existing transaction-edit timeout); no device/emulator evidence (empty-selection zero-capture, migration, Keystore invalidation, backup/restore, Doze/OEM); signing provenance unresolved with plaintext release values still in HEAD `android/gradle.properties:65-68`; V2 credential enrollment/rotation/revocation (G-V2-AUTH) not implemented — no writer exists for `brainia_mobile.v2AccessToken`, so delivery correctly holds as `BLOCKED_AUTH`; native capture still posts `contractVersion: 1` and accepts any 2xx without a v2 receipt, so no native v2 conformance is claimed (M03/M04).

## 8. Limitations

- No live backend or approved test service was contacted. Auth pause, receipts, batch ordering and capability negotiation are fixture/probe results, not integration tests.
- No device, emulator, ADB session, APK/AAB build, `apksigner`, Gradle test, or Metro bundling run. Whether Expo/Metro resolves the imported `.cjs` + JSON contract modules at bundle time is unverified by this report (typecheck and lint only).
- Verification covers the JavaScript contract layer. Native durable capture, revision identity, receipt persistence and the 10,000-capture E10 scenario are not established by M01.
- The dirty tree prevents hunk-level authorship attribution for `lib/api.ts` and `lib/domain.ts`; path scope and mtime evidence are conclusive for app/native/package files but not for authorship inside the two reserved dirty files.
- The sealed artifact still self-describes as proposed/unapproved (`approvalReady: false`); acceptance here is conformance to the ledger-pinned bytes, not contract approval, and it does not approve the five disabled gates or any provisional operation.
- This verifier created only this report inside the repository. Scratch copies and probes were confined to `C:/Users/germa/AppData/Local/Temp/opencode/`; no app, native, config, contract, or package file was modified, and no commit, install, build, device run, or backend write was performed. HEAD remains `a526b3498fff63df5374c72c11ab09ccc39d13fc`.

## 9. Addendum — M01-r2/M02-r3 re-verification (HEAD `b4c8748`)

Re-verified: 2026-10-18. Current HEAD is `b4c87486d4bd73aba2bfaf09fd5a078a9d79b38e` (commit `chore: complete mobile contract and credential follow-ups`), parent `cd39363`; the tree is clean except untracked `untitled.md`. The implementer reports `docs/reports/v2/M01-r2.md` and `M02-r3.md` describe the parent state (`cd39363`); their follow-up changes are committed in `b4c8748`. This addendum is read-only and supersedes only the stale command counts, extension-pin details, and C1/C3/C4 condition status above. No device, Play, signing-custody, or live-v2 acceptance is claimed.

### 9.1 Commands (current tree)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | **0** | `expo lint`; no diagnostics. |
| `npm run typecheck` | **0** | `tsc --noEmit`; no diagnostics. |
| `npm run contracts:verify` | **0** | `PASS 912 contract checks; 152 positive/negative schema+semantic fixtures; 7 identity sequences`; manifest `666af99f…bfb55`; `PASS 221 mobile conformance checks; 15 sealed files; 4 pinned extension files; 111 $defs; 19 OpenAPI paths`. |
| `android/: .\gradlew.bat :app:testDebugUnitTest --rerun-tasks` | **0** | `BUILD SUCCESSFUL`; XML `tests=21 failures=0 errors=0 skipped=0`. |
| `npm run agent:harness` | **1** | Five browser suites pass (`REVIEW_LOADING_OK`, `REVIEW_EMPTY_OK`, `REVIEW_EDITING_OK`, `REVIEW_AGENT_SMOKE_OK`, `CAPTURE_TRANSFER_AGENT_SMOKE_OK`); then the pre-existing `scripts/transaction-edit-agent-smoke.mjs:66` 120 s `Tipo de movimiento` timeout. Port 8090 closed afterwards. |
| SDK `adb devices` | **0** | Zero devices. |
| Guard probe (temp, real transport) | **0** | 23/23 checks (§9.2). |
| Offline probe (temp, real wrapper + transport) | **0** | 10/10 checks (§9.4). |
| Extension tamper probe (temp copy) | **1** | Modified `transport.cjs` fails the extension hash pin (`extension bytes transport.cjs`). |

### 9.2 Provisional-operation guard

Independent temp probe (`C:/Users/germa/AppData/Local/Temp/opencode/m02-followup/guard-probe.mjs`), using the real `transport.cjs` and `open-items.json`:

- The local `PROVISIONAL_OPERATIONS` list equals the 13 `implementationBlocked` names exactly.
- Each of the 13 operations rejects with `implementation_blocked` and **zero** fetcher calls when no gate is supplied, including calls with malformed bodies or unexpected query strings.
- `GET /api/v2/export?unexpected=1` is blocked by the guard before query validation; `GET /api/v2/export/` is rejected by path resolution and sends nothing.
- An unknown/misspelled gate enables nothing. A gate of `['GET /api/v2/export']` reaches the network for that operation only; `POST /api/v2/queries` remains blocked.
- `lib/api.ts` passes no fourth argument and contains no `enabledProvisionalOperations`, so the app defaults to fail-closed.

This closes the earlier C4 condition. The guard is caller-side only; a future task that intentionally enables a provisional operation must supply the allowlist and obtain new approval.

### 9.3 Extension trust root — pin works, ordering caveat

- `mobile/SHA256SUMS.json` covers exactly the four code files (`runtime.cjs`, `runtime.d.cts`, `transport.cjs`, `transport.d.cts`); each recomputed SHA-256 matches. The manifest bytes recompute to `e4e30a1a662889d93fb3b4325c1c381a49bd88292e096821ecb592c5044c26e7`, matching `EXTENSION_MANIFEST_SHA256` in `mobile/verify.mjs`.
- The manifest explicitly says `"trustRoot": "local repository manifest; not an external approval or G1 ledger claim"`; `verify.mjs` documents that `verify.mjs` itself is not covered and is anchored only by the repository commit. This is the documented local-only limitation, not an external signature.
- A temp copy with one appended comment in `transport.cjs` failed verification with exit 1 and a hash mismatch, so the pin does detect modified bytes.
- **Caveat (medium):** `verify.mjs` requires `./runtime.cjs` and `./transport.cjs` at lines 10-11, **before** it reads and pins `SHA256SUMS.json` at lines 54-62. The comment says the extension is pinned “before executing any of it,” but the extension modules have already executed. A malicious extension could therefore influence the verifier process before its hash is checked. The hash pin still catches ordinary edits (as the tamper probe shows), and `verify.mjs` itself is the ultimate local trust root, but the ordering claim is inaccurate. Deferring the `require` until after the hash check would make the stated property true.
- **C2 status:** local pin added; an external anchor (ledger/CI hash of the extension manifest or verifier) is still absent. C2 remains a release/assurance condition, not a hash mismatch.

### 9.4 Offline classification — two layers documented correctly

- Sealed transport, offline during `GET /api/v2/capabilities`: `HELD / unsupported_or_unavailable_capabilities`; one request; no observation POST (independent direct-transport probe, exit 0).
- Application wrapper in `lib/api.ts:938-969`: the same event is reclassified to `PENDING / offline_capabilities`; offline observation POST is `PENDING / offline`; missing token is `BLOCKED_AUTH / auth_missing` with zero requests; `503` capabilities remains `HELD` and is not reclassified (10/10 wrapper probe checks).
- `M01-r2.md` §4 and `M02-r3.md` §6 now state this distinction accurately. The earlier C1 wording condition is closed by documentation, not by changing the sealed transport.

### 9.5 Scope and condition status

Commit `b4c8748` changes only: `app/settings.tsx`, the four `contracts/.../mobile/*` follow-up files, `lib/notification-bridge.ts`, `lib/storage.ts`, the two follow-up reports, and generated `graphify-out/` files. No `package.json`, native Android, backend, dependency, or build-artifact change is in the commit. The `graphify-out/` refresh is generated DoD output, but `M01-r2.md`/`M02-r3.md` §8 omit it from their changed-file tables — a documentation omission, not code scope creep. `contracts/`, both backup XML files, and the JVM test are now tracked, closing C3 reproducibility. C5 (type-only `transport.d.cts` import of `lib/domain`) remains. C6 (G1 mobile reviewer sign-off) remains.

**Updated M01 verdict: accepted-with-conditions.** The byte import, provisional guard, and offline documentation are verified; remaining conditions are the local-only extension trust anchor plus the pre-verification require ordering, the typings layering, the G1 ledger sign-off, and the unchanged device/live-v2 limits. No enabled blocked operation, plaintext secret, hash mismatch, or functional regression was found.
