# Backend global-key authentication

Status: deployed to production (READY), live auth verified, and mobile defaults configured.

Backend: D:/Coding/BrainIA/BrainIA-Backend, branch main, base HEAD a4b6cf528f82828d99b4431ffc0e970fdbf56b32.
Mobile report: docs/reports/backend-global-key-auth.md.

## Read-only owner verification

Read DATABASE_URL from backend .env.local in memory without printing credentials. Queried through pg inside BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY, with a 15-second statement timeout, and ended with ROLLBACK. Only owner values and aggregate row counts were recorded. No database writes or migrations were performed.

| Table | Scope column | Owner value | Row count |
| --- | --- | --- | ---: |
| financial_transactions | owner_id | brainia-personal | 391 |
| financial_accounts | owner_id | brainia-personal | 11 |
| financial_custom_categories | client_scope | No rows | 0 |
| pending_financial_transactions | owner_id | No rows | 0 |
| raw_events | owner_id | brainia-personal | 1958 |
| raw_events | owner_id | NULL | 24 |
| raw_events | client_id | brainia-personal | 1982 |

The single identified owner is brainia-personal. Financial routes obtain ownerScope(request) from the authenticated principal. Transactions use owner_id filters with legacy evidence-client fallback; account reads and mutations enforce the same owner scope. Custom categories use financial_custom_categories.client_scope = ownerScope(request), alongside static built-in categories. The initial read-only probe referred to a nonexistent financial_categories table, which aborted that transaction; the corrected read-only probe above completed successfully against financial_custom_categories.

## Change and boundaries

In the populated clientKeys branch only, a completely absent x-brainia-client-id header plus a configured and matching globalApiKey now returns ownerId brainia-personal, clientId null, mode client, scopes [owner], authenticated true. Empty or whitespace client headers do not activate the fallback. Missing or wrong keys still fail; supplied unknown clients still fail; registered clients still require their own configured key. Existing client-key parsing and handling, owner-header rejection, global-only admin behavior, v2 bearer authentication, and cron behavior are unchanged. BRAINIA_CLIENT_KEYS and environment files were not modified.

## Verification

package.json has no dedicated auth script; its test script runs Node's test runner with tsx and includes tests/p0-foundation.test.ts. Ran that auth-containing file directly:

~~~text
$ node --test --import tsx tests/p0-foundation.test.ts
ok 1 - health remains public even when api auth is enabled
ok 2 - api routes reject missing credentials when auth is enabled
ok 3 - client-scoped auth resolves the configured identity
ok 4 - global key without a client header resolves the single production owner
ok 5 - global fallback preserves explicit client authentication and rejection paths
ok 6 - event dedupe keys scope retries by client and contract version
ok 7 - event dedupe keys prefer an explicit idempotency key
1..7
# tests 7
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10043.7687
Exit code: 0

$ npm run lint
> brainia-backend@0.1.0 lint
> tsc -p tsconfig.json --noEmit
Exit code: 0

$ git diff --check
Exit code: 0
~~~

The two added tests cover the requested fallback principal, missing/wrong credentials, an unconfigured global key, a client key without its header, successful registered-client authentication, unknown/empty/whitespace client rejection, and registered clients rejecting global/wrong/missing keys. All credentials in the diff are synthetic test fixtures. The full backend suite and live authenticated requests were not run. Deployment and production behavior verification remain pending by instruction; the owner binding is intentionally specific to this single-user installation.

No commit, push, stash, reset, clean, deployment, or production configuration changes were performed. Existing mobile changes were preserved; this report is the only mobile file added by this task.

## Exact backend diff

~~~diff
diff --git a/src/auth.ts b/src/auth.ts
index bf8f2da..8f89f84 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -137,6 +137,16 @@ export function resolveAuthContext(
   if (config.clientKeys.size > 0) {
     const clientId = readHeader(headers, CLIENT_ID_HEADER)?.trim();
     if (!clientId) {
+      if (readHeader(headers, CLIENT_ID_HEADER) === null && config.globalApiKey && apiKey === config.globalApiKey) {
+        // Single-user production owner, verified against the existing ledger.
+        return {
+          clientId: null,
+          ownerId: "brainia-personal",
+          mode: "client",
+          scopes: ["owner"],
+          authenticated: true,
+        };
+      }
       return {
         ok: false,
         statusCode: 401,
diff --git a/tests/p0-foundation.test.ts b/tests/p0-foundation.test.ts
index 45cfddc..4ce3c1a 100644
--- a/tests/p0-foundation.test.ts
+++ b/tests/p0-foundation.test.ts
@@ -72,6 +72,64 @@ test("client-scoped auth resolves the configured identity", () => {
   assert.equal(authContext.mode, "client");
 });
 
+test("global key without a client header resolves the single production owner", () => {
+  const authConfig: AuthConfig = {
+    globalApiKey: "global-test-key",
+    clientKeys: new Map([["mobile", "client-test-key"]]),
+  };
+
+  assert.deepEqual(resolveAuthContext({ "x-brainia-api-key": "global-test-key" }, authConfig), {
+    clientId: null,
+    ownerId: "brainia-personal",
+    mode: "client",
+    scopes: ["owner"],
+    authenticated: true,
+  });
+
+  for (const headers of [{}, { "x-brainia-api-key": "wrong-test-key" }, { "x-brainia-api-key": "client-test-key" }]) {
+    const result = resolveAuthContext(headers, authConfig);
+    assert.ok("ok" in result && !result.ok);
+    assert.equal(result.statusCode, 401);
+    assert.equal(result.error, "missing_client_id");
+  }
+
+  const noGlobalKey = resolveAuthContext({ "x-brainia-api-key": "global-test-key" }, { ...authConfig, globalApiKey: null });
+  assert.ok("ok" in noGlobalKey && !noGlobalKey.ok);
+  assert.equal(noGlobalKey.statusCode, 401);
+});
+
+test("global fallback preserves explicit client authentication and rejection paths", () => {
+  const authConfig: AuthConfig = {
+    globalApiKey: "global-test-key",
+    clientKeys: new Map([["mobile", "client-test-key"]]),
+  };
+  assert.deepEqual(resolveAuthContext({
+    "x-brainia-client-id": "mobile",
+    "x-brainia-api-key": "client-test-key",
+  }, authConfig), {
+    clientId: "mobile", ownerId: "mobile", mode: "client", scopes: ["owner"], authenticated: true,
+  });
+
+  for (const clientId of ["unknown", "", "   "]) {
+    const result = resolveAuthContext({
+      "x-brainia-client-id": clientId,
+      "x-brainia-api-key": "global-test-key",
+    }, authConfig);
+    assert.ok("ok" in result && !result.ok);
+    assert.equal(result.statusCode, clientId === "unknown" ? 403 : 401);
+    assert.equal(result.error, clientId === "unknown" ? "unknown_client" : "missing_client_id");
+  }
+  for (const apiKey of ["global-test-key", "wrong-test-key", undefined]) {
+    const result = resolveAuthContext({
+      "x-brainia-client-id": "mobile",
+      "x-brainia-api-key": apiKey,
+    }, authConfig);
+    assert.ok("ok" in result && !result.ok);
+    assert.equal(result.statusCode, 401);
+    assert.equal(result.error, "invalid_api_key");
+  }
+});
+
 test("event dedupe keys scope retries by client and contract version", () => {
   const dedupeKey = buildEventDedupeKey(
     {
~~~


## Production deployment and mobile configuration - 2026-10-21T12:19:45.131Z

This section supersedes the historical pending-deployment statements above.

- Outcome: SUCCEEDED.
- Vercel project: brain-ia (prj_UTY2FxQt1TaclNkbvuNCb6yLrCJK), production.
- Deployment ID: dpl_97xPJw75ByJNQeCqiSYaqCWiLjqQ.
- Deployment state: READY.
- Production alias: https://brain-ia-six.vercel.app.
- BRAINIA_API_KEY was set as a production Secret and verified by name only; BRAINIA_CLIENT_KEYS was not modified.
- Key fingerprint (first 4 / last 4): cf4e...456d.

| GET /api/v1/events check | HTTP status |
| --- | ---: |
| No API key | 401 |
| Wrong API key | 401 |
| New API key, no client-id header | 200 |

- Mobile defaultSettings.apiKey: configured with the verified new key.
- Mobile defaultSettings.clientId: empty.
- npm run lint exit code: 0.
- npx tsc --noEmit exit code: 0.
- Backend auth source and tests were not edited by this task; deployment includes their existing uncommitted changes.
- No commit, push, stash, reset, or clean was performed; pre-existing changes were preserved.
