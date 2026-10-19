import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { canonical, sha256 } from '../canonical.mjs';

const require = createRequire(import.meta.url);
const runtime = require('./runtime.cjs');
const { createV2Transport, parseStrict, PROVISIONAL_OPERATIONS } = require('./transport.cjs');
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = path.join(dir, 'mobile');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

// External trust anchors. The manifest hash is the B02-r4 metadata reseal of the
// G1-approved bundle (open-items.json records the G1 value this supersedes); the
// spec hash is the approved normative document the bundle snapshot was copied from.
const MANIFEST_SHA256 = 'da2a989f6a607439bec3dabc21fbb4331efa58b2765f94e71a6b213ed2fd621c';
const NORMATIVE_SPEC_SHA256 = 'ee74de0eb890b4acf69b4356daef978934c8553731636093184fb14aae3022a1';
const SEALED_FILES = [
  'README.md', 'ajv-formats.LICENSE', 'ajv.LICENSE', 'build-bundle.mjs',
  'build-fixtures.mjs', 'canonical.mjs', 'fixtures.json', 'open-items.json',
  'openapi.json', 'schema.json', 'seal.mjs', 'spec.md',
  'validator-provenance.json', 'validators.cjs', 'verify.mjs',
];
const EXTENSION_FILES = ['runtime.cjs', 'runtime.d.cts', 'transport.cjs', 'transport.d.cts'];
// mobile/SHA256SUMS.json is a LOCAL repository manifest: it records what this
// working tree builds, not an external approval or a G1 ledger claim. Pinning
// its exact bytes here turns an unnoticed manifest edit into a verifier failure.
// verify.mjs is the trust root that performs the check, so it is deliberately
// not covered by the manifest it authenticates; its integrity is anchored only
// by the repository commit (see docs/reports/v2/M01-r2.md and M02-r3.md).
const EXTENSION_MANIFEST_SHA256 = 'e4e30a1a662889d93fb3b4325c1c381a49bd88292e096821ecb592c5044c26e7';

// 1. Pin the approved manifest and every sealed member independently.
const manifestBytes = fs.readFileSync(path.join(dir, 'SHA256SUMS.json'));
assert.equal(sha256(manifestBytes), MANIFEST_SHA256, 'resealed G1 manifest');
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.algorithm, 'sha256', 'manifest algorithm');
const sealedNames = Object.keys(manifest.files).sort();
assert.deepEqual(sealedNames, [...SEALED_FILES].sort(), 'manifest covers exactly the sealed set');
for (const name of sealedNames) {
  assert.ok(!/[\\/]/.test(name), 'manifest name has no path separator: ' + name);
  assert.equal(sha256(fs.readFileSync(path.join(dir, name))), manifest.files[name], 'sealed bytes ' + name);
}
assert.deepEqual(
  fs.readdirSync(dir).filter(name => name !== 'mobile').sort(),
  [...SEALED_FILES, 'SHA256SUMS.json'].sort(),
  'no unsealed files in the bundle root'
);
assert.equal(sha256(fs.readFileSync(path.join(dir, 'spec.md'))), NORMATIVE_SPEC_SHA256, 'spec.md is the approved normative snapshot');

// 2. Independently pin the mobile extension before executing any of it.
const extensionManifestBytes = fs.readFileSync(path.join(mobileDir, 'SHA256SUMS.json'));
assert.equal(sha256(extensionManifestBytes), EXTENSION_MANIFEST_SHA256, 'local extension manifest pin');
const extensionSums = JSON.parse(extensionManifestBytes);
assert.equal(extensionSums.algorithm, 'sha256', 'extension manifest algorithm');
assert.deepEqual(Object.keys(extensionSums.files).sort(), [...EXTENSION_FILES].sort(), 'extension manifest covers exactly the extension');
for (const name of EXTENSION_FILES) {
  assert.ok(!/[\\/]/.test(name), 'extension name has no path separator: ' + name);
  assert.equal(sha256(fs.readFileSync(path.join(mobileDir, name))), extensionSums.files[name], 'extension bytes ' + name);
}
assert.deepEqual(
  fs.readdirSync(mobileDir).filter(name => name !== 'SHA256SUMS.json' && name !== 'verify.mjs').sort(),
  [...EXTENSION_FILES].sort(),
  'no unpinned extension files'
);

// 3. Pin the approved contract surface before trusting the sealed verifier.
const schema = read('schema.json');
const openapi = read('openapi.json');
const openItems = read('open-items.json');
assert.equal(Object.keys(schema.$defs).length, 111, 'approved $defs count');
assert.equal(Object.keys(openapi.paths).length, 19, 'approved OpenAPI path count');
assert.equal(schema.$defs.Capabilities.properties.maxBatchItems.const, 100, 'batch limit 1..100');
assert.equal(schema.$defs.Capabilities.properties.currencyRegistryVersion.const, 'ISO4217-CLDR-45', 'currency registry version');
assert.equal(schema.$defs.Capabilities.properties.features.properties.observationRevisions.const, true, 'observation revisions gate');
assert.equal(schema.$defs.Capabilities.properties.features.properties.decimalFinance.const, true, 'decimal finance gate');
for (const gate of ['email', 'activity', 'location', 'episodes', 'connectors']) {
  assert.equal(schema.$defs.Capabilities.properties.features.properties[gate].const, false, 'false gate ' + gate);
}
assert.equal(openItems.revision, 'B02-r3', 'approved revision');
assert.equal(openItems.openDecisionCount, 0, 'no open decisions');
assert.ok(!openItems.items.some(item => item.status === 'open'), 'no item remains open');

// 4. Execute the exact sealed verifier. Two hooks are scoped to this repository:
//    the mobile extension directory is not a sealed file, and the vendored
//    spec.md (already pinned to NORMATIVE_SPEC_SHA256 above) substitutes for
//    the backend-only normative document path.
const readdir = fs.readdirSync, readFile = fs.readFileSync;
const externalSpec = path.resolve(dir, '../../../docs/BRAIN_AI_V2_API_CONTRACT_v2.0.0.md');
fs.readdirSync = function (target, ...args) {
  const names = readdir.call(this, target, ...args);
  return path.resolve(String(target)) === dir ? names.filter(name => name !== 'mobile') : names;
};
fs.readFileSync = function (target, ...args) {
  return readFile.call(this, path.resolve(String(target)) === externalSpec ? path.join(dir, 'spec.md') : target, ...args);
};
try { await import('../verify.mjs'); }
finally { fs.readdirSync = readdir; fs.readFileSync = readFile; }

// 5. Mobile portable runtime parity against every approved fixture. Validators
//    and runtime share one isolated realm so cross-realm object identity cannot
//    mask a semantic difference; fixture values are parsed inside that realm.
const fixtures = read('fixtures.json');
let checks = 0;
const sandbox = { console };
vm.createContext(sandbox);
sandbox.module = { exports: {} };
sandbox.exports = sandbox.module.exports;
sandbox.require = name => { throw Error('portable runtime must not require ' + name); };
vm.runInContext(fs.readFileSync(path.join(dir, 'validators.cjs'), 'utf8'), sandbox);
const validatorExports = sandbox.module.exports;
sandbox.module = { exports: {} };
sandbox.exports = sandbox.module.exports;
sandbox.require = name => { assert.equal(name, '../validators.cjs'); return validatorExports; };
vm.runInContext(fs.readFileSync(path.join(mobileDir, 'runtime.cjs'), 'utf8'), sandbox);
vm.runInContext([
  'globalThis.__portableValid = (name, json) => module.exports.valid(name, JSON.parse(json));',
  'globalThis.__portableCanonical = json => module.exports.canonical(JSON.parse(json));',
  'globalThis.__portableSha256 = json => module.exports.sha256(JSON.parse(json));',
].join('\n'), sandbox);

for (const c of fixtures.schemaCases) {
  assert.equal(runtime.valid(c.schema, c.value), c.valid, c.name);
  assert.equal(sandbox.__portableValid(c.schema, JSON.stringify(c.value)), c.valid, 'portable ' + c.name); checks++;
}
for (const c of fixtures.canonicalCases) {
  if (c.invalid) {
    assert.throws(() => runtime.canonical(c.input));
    assert.throws(() => sandbox.__portableCanonical(JSON.stringify(c.input)));
  } else {
    assert.equal(runtime.canonical(c.input), canonical(c.input), c.name);
    assert.equal(runtime.sha256(runtime.canonical(c.input)), c.sha256, c.name);
    assert.equal(sandbox.__portableCanonical(JSON.stringify(c.input)), canonical(c.input), 'portable ' + c.name);
    assert.equal(sandbox.__portableSha256(JSON.stringify(sandbox.__portableCanonical(JSON.stringify(c.input)))), c.sha256, 'portable ' + c.name);
  }
  checks++;
}
for (const c of fixtures.acknowledgementCases) {
  assert.equal(runtime.acceptsReceipt(c.status, c.envelope, c.receipt), c.accepted, c.name); checks++;
}

// Unicode and hash conformance, independent of the frozen fixture oracles.
assert.equal(runtime.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); checks++;
assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}'); checks++;
assert.equal(canonical([-0, 1e30, 0.002]), '[0,1e+30,0.002]'); checks++;
assert.equal(canonical({ '\ue000': 1, '\ud83d\ude00': 2 }), '{"\ud83d\ude00":2,"\ue000":1}'); checks++;
const composed = fixtures.canonicalCases.find(c => c.name === 'composed');
const decomposed = fixtures.canonicalCases.find(c => c.name === 'decomposed');
assert.ok(composed && decomposed && composed.sha256 !== decomposed.sha256, 'no Unicode normalization'); checks++;
for (const text of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"x":{"a":1,"a":2}}', '{"a":"\\ud800"}']) {
  assert.throws(() => parseStrict(text)); checks++;
}
assert.deepEqual(parseStrict('{"a":[1,true,null,"á😀"]}'), { a: [1, true, null, 'á😀'] }); checks++;

// Decimal money is exact at six scale; no floating point is used.
const scaled = value => {
  const negative = value.startsWith('-');
  const [integer, fraction = ''] = value.replace(/^-/, '').split('.');
  const n = BigInt(integer) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  return negative ? -n : n;
};
assert.ok(fixtures.moneyCases.length >= 2, 'decimal fixtures present'); checks++;
for (const c of fixtures.moneyCases) {
  assert.equal(scaled(c.refund) - scaled(c.expense), scaled(c.net), 'exact decimal ' + c.currency);
  assert.ok(['UYU', 'USD'].includes(c.currency), 'registered currency ' + c.currency);
  assert.ok([c.expense, c.refund, c.net].every(v => /^-?(0|[1-9][0-9]*)\.[0-9]{2}$/.test(v)), 'currency precision ' + c.currency);
  checks++;
}

// Error envelopes, including field/conflict/retry/blocked details, must validate.
const errorCases = fixtures.schemaCases.filter(c => c.name.startsWith('error-'));
assert.ok(errorCases.length >= 10, 'error fixtures present'); checks++;
for (const c of errorCases) assert.equal(runtime.valid(c.schema, c.value), c.valid, c.name); checks++;

// 6. Transport: capability gates, auth states and the approved receipt contract.
const capabilities = fixtures.schemaCases.find(c => c.name === 'capabilities-resolved' && c.valid).value;
assert.equal(capabilities.maxBatchItems, 100, 'fixture batch limit');
assert.equal(capabilities.currencyRegistryVersion, 'ISO4217-CLDR-45', 'fixture registry version');
const envelope = fixtures.schemaCases.find(c => c.name === 'new-notification' && c.valid).value;
const activityEnvelope = fixtures.schemaCases.find(c => c.name === 'activity' && c.valid).value;
const emailEnvelope = fixtures.schemaCases.find(c => c.name === 'email' && c.valid).value;
const ack = fixtures.acknowledgementCases.find(c => c.accepted);
const response = (value, status = 200, headers = {}) => ({
  ok: status < 400, status, headers: { get: name => headers[name] ?? null },
  text: async () => typeof value === 'string' ? value : JSON.stringify(value),
});
const errorBody = (code, retryable = false) => ({
  error: { code, message: code, requestId: 'fixture', retryable },
});
const revision = { envelope, state: 'PENDING' };

for (const capability of [
  fixtures.schemaCases.find(c => c.name === 'capabilities-old-batch-limit' && !c.valid).value,
  fixtures.schemaCases.find(c => c.name === 'capabilities-email-enabled' && !c.valid).value,
  { ...capabilities, currencyRegistryVersion: 'ISO4217-OLD' },
  { apiVersion: '2.0.0' },
]) {
  const calls = [];
  const client = createV2Transport('https://mobile.invalid', 'test-token', async (url, options) => {
    calls.push({ url, options });
    return response(capability);
  });
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'HELD', 'unsupported capabilities hold');
  assert.equal(result.reason, 'unsupported_or_unavailable_capabilities');
  assert.equal(result.envelope, envelope);
  assert.deepEqual(calls.map(call => call.url), ['https://mobile.invalid/api/v2/capabilities']);
  checks++;
}

// Advertised-but-disabled gates hold the exact queued bytes without a POST.
for (const candidate of [activityEnvelope, emailEnvelope]) {
  const calls = [];
  const client = createV2Transport('https://mobile.invalid', 'test-token', async (url) => {
    calls.push(url);
    return url.endsWith('capabilities') ? response(capabilities) : response(ack.receipt, 201);
  });
  const result = await client.deliverRevision({ envelope: candidate, state: 'PENDING' });
  assert.equal(result.state, 'HELD', 'feature gate hold');
  assert.equal(result.reason, 'capabilities.featureGates');
  assert.deepEqual(calls, ['https://mobile.invalid/api/v2/capabilities'], 'gate hold sends no observation');
  checks++;
}

// Missing credential never reaches the network and blocks authentication.
{
  const calls = [];
  const client = createV2Transport('https://mobile.invalid', undefined, async (...args) => { calls.push(args); return response(capabilities); });
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'BLOCKED_AUTH');
  assert.equal(result.reason, 'auth_missing');
  assert.equal(calls.length, 0);
  checks++;
}

// Bearer token is provisioned per request through the provider.
for (const token of ['test-token', async () => 'test-token']) {
  const calls = [];
  const client = createV2Transport('https://mobile.invalid', token, async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('capabilities') ? response(capabilities) : response(ack.receipt, 201);
  });
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'ACKNOWLEDGED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  checks++;
}

// 401 pauses the queue; 403 holds the operation; neither retries as PENDING.
for (const [status, code, state, reason] of [
  [401, 'unauthenticated', 'BLOCKED_AUTH', 'blocked_auth'],
  [401, 'invalid_request', 'BLOCKED_AUTH', 'blocked_auth'],
  [403, 'forbidden', 'HELD', 'forbidden'],
]) {
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url =>
    url.endsWith('capabilities') ? response(capabilities) : response(errorBody(code, false), status));
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, state, 'auth status ' + status);
  assert.equal(result.reason, reason);
  checks++;
}
{
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url =>
    url.endsWith('capabilities') ? response(capabilities) : response('', 401));
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'BLOCKED_AUTH', 'bodyless 401');
  checks++;
}

// 409/422/429/503 stay retryable PENDING; unsupported_contract is HELD.
for (const [status, code] of [[409, 'identity_conflict'], [422, 'version_conflict'], [429, 'rate_limited'], [503, 'unavailable']]) {
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url => url.endsWith('capabilities')
    ? response(capabilities)
    : response(errorBody(code, status !== 409), status, status === 429 || status === 503 ? { 'Retry-After': '30' } : {}));
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'PENDING', 'retryable status ' + status);
  assert.equal(result.reason, code);
  checks++;
}
{
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url =>
    url.endsWith('capabilities') ? response(capabilities) : response(errorBody('unsupported_contract'), 422));
  const result = await client.deliverRevision(revision);
  assert.equal(result.state, 'HELD');
  checks++;
}

// Receipts are accepted only for the exact queued identity.
for (const [receipt, expected] of [[ack.receipt, 'ACKNOWLEDGED'], [{ ok: true }, 'PENDING'], [{ ...ack.receipt, deliveryId: '00000000-0000-4000-8000-000000000000' }, 'PENDING']]) {
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url =>
    url.endsWith('capabilities') ? response(capabilities) : response(receipt, 201));
  assert.equal((await client.deliverRevision({ envelope: ack.envelope, state: 'PENDING' })).state, expected);
  checks++;
}
{
  const client = createV2Transport('https://mobile.invalid', 'test-token', async url =>
    url.endsWith('capabilities') ? response(capabilities) : response('{', 201));
  assert.equal((await client.deliverRevision(revision)).state, 'PENDING', 'malformed 2xx');
  checks++;
}
{
  const client = createV2Transport('https://mobile.invalid', 'test-token', async () => { throw Error('offline'); });
  assert.equal((await client.deliverRevision(revision)).state, 'HELD', 'offline capability check');
  checks++;
}

// Batch results must be ordered and receipt-checked per item.
{
  const batch = fixtures.schemaCases.find(c => c.name === 'batch-request' && c.valid).value;
  const result = { results: [{ index: 0, deliveryId: batch.items[0].deliveryId, status: 201, receipt: ack.receipt }] };
  const client = createV2Transport('https://mobile.invalid', 'test-token', async () => response(result));
  const reply = await client.request('POST', '/api/v2/observations/batch', batch);
  assert.equal(reply.status, 200);
  checks++;
}

// Unpublished operations and unexpected request fields still fail closed.
await assert.rejects(createV2Transport('https://mobile.invalid', 'test-token', async () => response(ack.receipt)).request('POST', '/api/v2/deletions', {}));
await assert.rejects(createV2Transport('https://mobile.invalid', 'test-token', async () => response(capabilities)).request('POST', '/api/v2/observations', { ...envelope, ownerId: 'forbidden' }));
checks++;

// 7. Provisional (implementationBlocked) operations fail closed by default.
//    The local list must match the sealed open-items.json exactly, every listed
//    operation must be refused before any network call, and an explicit local
//    allowlist may enable only the named operation.
{
  const blocked = openItems.items.filter(item => item.implementationBlocked).map(item => item.name).sort();
  assert.deepEqual([...PROVISIONAL_OPERATIONS].sort(), blocked, 'provisional operations match open-items.json');
  checks++;
  for (const name of PROVISIONAL_OPERATIONS) {
    const [method, template] = name.split(' ');
    const path = template.replace('{id}', 'fixture-id');
    const calls = [];
    const client = createV2Transport('https://mobile.invalid', 'test-token', async (...args) => {
      calls.push(args);
      return response(errorBody('unexpected'));
    });
    await assert.rejects(client.request(method, path), error => error.code === 'implementation_blocked', name);
    assert.equal(calls.length, 0, 'no network for provisional ' + name);
    checks++;
  }
  // An unknown gate value enables nothing.
  await assert.rejects(
    createV2Transport('https://mobile.invalid', 'test-token', async () => response(errorBody('unexpected')), { enabledProvisionalOperations: ['not-an-operation'] }).request('GET', '/api/v2/export'),
    error => error.code === 'implementation_blocked'
  );
  checks++;
  // The explicit local gate reaches the network for exactly that operation.
  const exportResponse = fixtures.schemaCases.find(c => c.name === 'export-response' && c.valid).value;
  const gatedCalls = [];
  const gated = createV2Transport('https://mobile.invalid', 'test-token', async url => {
    gatedCalls.push(url);
    return response(exportResponse);
  }, { enabledProvisionalOperations: ['GET /api/v2/export'] });
  const gatedReply = await gated.request('GET', '/api/v2/export');
  assert.equal(gatedReply.status, 200);
  assert.deepEqual(gatedCalls, ['https://mobile.invalid/api/v2/export']);
  checks++;
  // The gate is per operation and does not spill into another provisional call.
  await assert.rejects(gated.request('POST', '/api/v2/queries', {}), error => error.code === 'implementation_blocked');
  checks++;
}

console.log(`PASS ${checks} mobile conformance checks; approved manifest ${MANIFEST_SHA256}; ${sealedNames.length} sealed files; ${EXTENSION_FILES.length} pinned extension files; ${Object.keys(schema.$defs).length} $defs; ${Object.keys(openapi.paths).length} OpenAPI paths.`);
