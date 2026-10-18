const { assertContract, valid, acceptsReceipt, canonical } = require('./runtime.cjs');
const api = require('../openapi.json');

// JSON.parse alone accepts duplicate names. Scan the grammar before parsing so
// identity, version and receipt fields cannot have ambiguous wire values.
function parseStrict(text) {
  let at = 0;
  const ws = () => { while (/\s/.test(text[at] || '') && at < text.length) at++; };
  function string() {
    const start = at++;
    while (at < text.length) {
      const c = text[at++];
      if (c === '\\') { at++; continue; }
      if (c === '"') return JSON.parse(text.slice(start, at));
    }
    throw Error('Unterminated JSON string');
  }
  function value() {
    ws();
    if (text[at] === '"') { string(); return; }
    if (text[at] === '{' || text[at] === '[') {
      const object = text[at++] === '{', end = object ? '}' : ']';
      const keys = new Set();
      ws();
      if (text[at] === end) { at++; return; }
      while (at < text.length) {
        if (object) {
          ws(); if (text[at] !== '"') throw Error('Invalid JSON key');
          const key = string();
          if (keys.has(key)) throw Error('Duplicate JSON member');
          keys.add(key); ws(); if (text[at++] !== ':') throw Error('Invalid JSON colon');
        }
        value(); ws();
        if (text[at] === end) { at++; return; }
        if (text[at++] !== ',') throw Error('Invalid JSON separator');
      }
      throw Error('Unterminated JSON container');
    }
    const match = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
    if (!match) throw Error('Invalid JSON value');
    at += match[0].length;
  }
  value(); ws(); if (at !== text.length) throw Error('Trailing JSON');
  const result = JSON.parse(text); canonical(result); return result;
}

function transportError(message, status, code) {
  const error = new Error(message);
  if (status !== undefined) error.status = status;
  if (code !== undefined) error.code = code;
  return error;
}

// Content types the approved contract can gate through /api/v2/capabilities.
// Email, activity and location are false in the approved capability document;
// a server that advertises them as enabled is not a conforming 2.0.0 server.
const CONTENT_FEATURE_GATES = { email: 'email', activity: 'activity', location: 'location' };

// B02-r3 publishes strict schemas and fixtures for these thirteen operations but
// marks every one implementationBlocked: true. The generic request() must not
// become a bypass: each operation fails closed unless the caller passes an
// explicit local feature gate. Server capabilities never authorize these, and
// the application passes no gate by default. mobile/verify.mjs cross-checks this
// list against open-items.json so the two cannot drift silently.
const PROVISIONAL_OPERATIONS = [
  'GET /api/v2/observations/{id}',
  'GET /api/v2/observations/{id}/revisions',
  'GET /api/v2/events/{id}',
  'GET /api/v2/episodes',
  'GET /api/v2/episodes/{id}',
  'GET /api/v2/financial/transactions',
  'POST /api/v2/corrections',
  'GET /api/v2/export',
  'POST /api/v2/queries',
  'GET /api/v2/queries/{id}',
  'POST /api/v2/connectors/email/authorize',
  'GET /api/v2/connectors/email/callback',
  'POST /api/v2/connectors/{id}/revoke',
];
const PROVISIONAL = new Set(PROVISIONAL_OPERATIONS);

function isAuthFailure(error) {
  return !!error && (error.status === 401 || error.code === 'unauthenticated' || error.code === 'auth_missing');
}

function capabilityHold(revision, error) {
  if (isAuthFailure(error)) {
    return { ...revision, state: 'BLOCKED_AUTH', reason: error.code === 'auth_missing' ? 'auth_missing' : 'blocked_auth' };
  }
  if (error && error.status === 403) {
    return { ...revision, state: 'HELD', reason: error.code || 'forbidden' };
  }
  return { ...revision, state: 'HELD', reason: 'unsupported_or_unavailable_capabilities' };
}

// accessToken is a string or a provider resolved for every request. A missing
// credential fails closed: v2 is never sent unauthenticated and the queue holds.
function createV2Transport(baseUrl, accessToken, fetcher = (...args) => fetch(...args), options = {}) {
  // Fail closed: only an explicit caller-side allowlist can enable a
  // provisional operation. Unknown or malformed gate values enable nothing.
  const enabledProvisional = new Set(
    Array.isArray(options.enabledProvisionalOperations)
      ? options.enabledProvisionalOperations.filter(name => typeof name === 'string' && PROVISIONAL.has(name))
      : []
  );
  async function resolveToken() {
    return typeof accessToken === 'function' ? accessToken() : accessToken;
  }
  async function request(method, path, body) {
    // Resolve only published operations; excluded G1 operations fail closed.
    const url = new URL(path, 'https://contract.invalid');
    if (!path.startsWith('/api/v2/') || url.origin !== 'https://contract.invalid' || url.hash) throw Error('Invalid v2 path');
    let operation;
    let operationName;
    for (const [route, methods] of Object.entries(api.paths)) {
      const parts = route.split('/'), actual = url.pathname.split('/');
      if (parts.length !== actual.length) continue;
      if (!parts.every((part, i) => part.startsWith('{') || part === actual[i])) continue;
      operation = methods[method.toLowerCase()];
      if (!operation) continue;
      operationName = method.toUpperCase() + ' ' + route;
      parts.forEach((part, i) => { if (part.startsWith('{')) assertContract('Id', decodeURIComponent(actual[i])); });
      break;
    }
    if (!operation) throw Error('Operation blocked by G1 contract');
    // Refuse provisional operations before query/body validation, auth or any
    // network call, so the guard cannot be skipped by malformed input.
    if (PROVISIONAL.has(operationName) && !enabledProvisional.has(operationName)) {
      throw transportError('Operation blocked pending contract review', undefined, 'implementation_blocked');
    }
    const params = (operation.parameters || []).filter(p => p.in === 'query');
    for (const key of url.searchParams.keys()) {
      if (!params.some(p => p.name === key) || url.searchParams.getAll(key).length !== 1) throw Error('Invalid v2 query');
    }
    for (const param of params) {
      const value = url.searchParams.get(param.name);
      if (value === null) { if (param.required) throw Error('Missing v2 query'); continue; }
      if (param.schema.$ref) assertContract(param.schema.$ref.split('/').pop(), value);
    }
    if (url.searchParams.has('conversionTo') !== url.searchParams.has('fxRateId')) throw Error('Incomplete conversion query');
    const schema = operation.requestBody?.content['application/json'].schema.$ref.split('/').pop();
    if (schema) assertContract(schema, body);
    else if (body !== undefined) throw Error('Unexpected v2 body');
    // The approved contract exempts only the connector callback (security: []).
    // Every other operation is device-bearer authenticated and fails closed.
    const requiresAuth = operation.security?.length !== 0;
    const token = requiresAuth ? await resolveToken() : null;
    if (requiresAuth && !token) throw transportError('Missing v2 bearer credential', 401, 'auth_missing');
    const response = await fetcher(baseUrl.replace(/\/+$/, '') + path, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(schema ? { 'content-type': 'application/json' } : {}) },
      body: schema ? JSON.stringify(body) : undefined,
    });
    const status = response.status;
    let json;
    try {
      json = parseStrict(await response.text());
    } catch (error) {
      error.status = status;
      throw error;
    }
    const declared = operation.responses[status];
    if (!declared) throw transportError('Unexpected v2 status', status);
    const responseSchema = declared.content?.['application/json']?.schema?.$ref.split('/').pop();
    if (!responseSchema) {
      if (!response.ok) throw transportError('Unexpected v2 status', status);
      return { status, value: json };
    }
    if (!valid(responseSchema, json)) {
      throw transportError('Invalid v2 contract: ' + responseSchema, status, json?.error?.code);
    }
    for (const [name, header] of Object.entries(declared.headers || {})) {
      if (header.required && !response.headers?.get(name)) throw transportError('Missing required v2 response header', status);
    }
    if (!response.ok) {
      throw transportError(json.error.message, status, json.error.code);
    }
    if (schema === 'Envelope' && !acceptsReceipt(status, body, json)) throw transportError('Mismatched receipt', status);
    if (schema === 'BatchRequest') {
      if (json.results.length !== body.items.length) throw transportError('Incomplete batch response', status);
      json.results.forEach((item, i) => {
        if (item.index !== i) throw transportError('Reordered batch response', status);
        if (item.deliveryId !== body.items[i].deliveryId) throw transportError('Reordered batch response', status);
        if (item.status < 400 && !acceptsReceipt(item.status, body.items[i], item.receipt)) throw transportError('Mismatched batch receipt', status);
      });
    }
    return { status, value: json };
  }
  async function deliverRevision(revision) {
    assertContract('Envelope', revision.envelope);
    if (revision.state === 'ACKNOWLEDGED') return revision;
    let capabilities;
    try {
      const result = await request('GET', '/api/v2/capabilities');
      if (!valid('Capabilities', result.value)) throw transportError('Unsupported server', result.status);
      capabilities = result.value;
    } catch (error) {
      return capabilityHold(revision, error);
    }
    // Server-advertised gates are authoritative. An unadvertised gate keeps
    // the exact queued bytes and never reaches the observation endpoint.
    const gate = CONTENT_FEATURE_GATES[revision.envelope.content.type];
    if (gate && capabilities.features[gate] !== true) {
      return { ...revision, state: 'HELD', reason: 'capabilities.featureGates' };
    }
    try {
      const result = await request('POST', '/api/v2/observations', revision.envelope);
      if (!acceptsReceipt(result.status, revision.envelope, result.value)) throw transportError('Mismatched receipt', result.status);
      return { ...revision, state: 'ACKNOWLEDGED', receipt: result.value, reason: undefined };
    } catch (error) {
      if (isAuthFailure(error)) {
        return { ...revision, state: 'BLOCKED_AUTH', reason: 'blocked_auth' };
      }
      if (error && error.status === 403) {
        return { ...revision, state: 'HELD', reason: error.code || 'forbidden' };
      }
      return { ...revision, state: error && error.code === 'unsupported_contract' ? 'HELD' : 'PENDING', reason: (error && error.code) || 'invalid_or_missing_acknowledgement' };
    }
  }
  return { request, deliverRevision };
}
module.exports = { createV2Transport, parseStrict, PROVISIONAL_OPERATIONS };
