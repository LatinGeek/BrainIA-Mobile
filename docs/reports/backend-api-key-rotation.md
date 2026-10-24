# Backend API key rotation

- Date: 2026-10-20 (America/Montevideo).
- Outcome: blocked; rotation not performed, per coordinator instruction.
- Intended variable: `BRAINIA_API_KEY`, Vercel Production environment.
- Confirmed project: `latingeeks-projects/brain-ia`, project ID `prj_UTY2FxQt1TaclNkbvuNCb6yLrCJK`.
- Backend checkout: `D:/Coding/BrainIA/BrainIA-Backend`, branch `main`, HEAD `a4b6cf528f82828d99b4431ffc0e970fdbf56b32`; initially clean.
- Mobile checkout: branch `LatinGeek/glass-design-polish`, HEAD `fe0c8b5d660b6ccb8e7e6f526fe932431e0f9bdf`; pre-existing modifications preserved.
- Vercel CLI: 65.0.0; authenticated as `latingeek`; linked project confirmed by `vercel project inspect --non-interactive`.
- Production variable names: `BRAINIA_CLIENT_KEYS` and `BRAINIA_REQUIRE_AUTH` exist; `BRAINIA_API_KEY` was absent. No values were retrieved.
- Redeploy ID/status: none / not attempted.
- Key fingerprint: none; no new key generated.

## HTTP verification

| Request | HTTP status |
| --- | --- |
| GET https://brain-ia-six.vercel.app/health, missing key | 200 |
| GET /health, new key | Not attempted; no key generated |
| GET /health, wrong or old key | Not attempted |
| Protected /api/ route with new key | Not attempted; rotation stopped |

## Findings and coordinator decisions

`src/app.ts:72` registers `/health` before the API authentication hook, and `src/auth.ts:263` exempts non-`/api/` paths. Consequently `/health` is public and cannot prove key rejection. The coordinator approved recording it as public and using a read-only protected API route instead, without changing backend authentication.

`src/auth.ts:143` gives configured client keys precedence over the global key. Because Production already has `BRAINIA_CLIENT_KEYS`, adding only `BRAINIA_API_KEY` would not authenticate requests. Client-key authentication also requires a registered `x-brainia-client-id`, while mobile `defaultSettings.clientId` is empty. The existing mobile default API key is empty as well.

The coordinator subsequently instructed: stop; do not change any production environment variable, do not redeploy, leave app files unchanged, and report failure so the owner can decide the authentication approach. No credentials, backend source, or mobile source were changed; this report is the only file written by this task.

## Verification

- `npm run lint`: exit 0.
- `npx tsc --noEmit`: exit 0.
- Both checks ran against the unchanged mobile source and existing worktree modifications.

## Remaining work

The owner must select a client identity and authorize a matching client-key/default-client-ID change, or authorize a different backend authentication approach. Rotation, production redeployment, and authenticated endpoint verification remain pending.

## Dedicated mobile client attempt (2026-10-20)

- Outcome: failed before mutation; blocked on unreadable existing production Secret.
- Requested client ID: `brainia-mobile`; not added, because existing IDs cannot be checked.
- Environment variable: `BRAINIA_CLIENT_KEYS`, production only.
- Vercel project: `brain-ia` / `prj_UTY2FxQt1TaclNkbvuNCb6yLrCJK`; team `team_VIU18sXii6mkmp6NhI4JpM5X`.
- Authentication: connector returned 403 for missing team grant; installed CLI 65.0.0 independently authenticated and confirmed the exact project successfully.
- Existing variable metadata: ID `tMaipyU5YnnMT5Lu`, type `sensitive`, target `production` only.
- GET of the individual variable returned metadata without a `value` field; existing Secret contents are unavailable through this credential path.
- Client entry count before: unknown; after: unchanged, unknown. Existing client names: unavailable. No environment update was attempted, so existing entries were left untouched.
- New key fingerprint: none; key generation was deferred until safe append was possible, and no new key exists.
- Redeploy ID/status: none / not attempted.
- HTTP results for protected GET: missing key, wrong key, and new key all not attempted in this dispatch; no new key was created or deployed.
- Confirmed authentication headers from `src/auth.ts`: `x-brainia-api-key` and `x-brainia-client-id`; `/health` remains unsuitable because it is public.
- Mobile `lib/app-state.tsx`: unchanged; no credentials written.
- Checks in this dispatch: `npm run lint` exit 0; `npx tsc --noEmit` exit 0.
- Coordinator escalation: `msg_2de0f4cf97b4` in task `task_3088948032e1`, dispatch `ctx_59ac2e12cbf7`.
- Remaining work: obtain an owner-authorized secure source of the exact current client-list value or revise the registration approach; then safely append one unique client, redeploy, verify protected endpoint statuses, and update the mobile defaults.

The earlier report above records the prior attempt and its coordinator stop instruction; this new dispatch explicitly authorized the dedicated client approach, but encountered the separate Secret read limitation documented here. Pre-existing worktree changes were preserved, and no commit, push, stash, reset, or clean was performed.
