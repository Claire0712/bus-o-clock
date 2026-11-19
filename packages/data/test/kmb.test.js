import test from 'node:test';
import assert from 'node:assert/strict';
import { createKmbClient } from '../src/kmb.js';
const stopId = '18492910339410B1';
const stop = { stop: stopId, name_en: 'Stop', name_tc: '站', lat: '22.3', long: '114.2' };
const route = { route: '1', bound: 'O', service_type: '1', orig_en: 'Origin', dest_en: 'Destination' };
const response = data => new Response(JSON.stringify({ generated_timestamp: new Date().toISOString(), data }), { headers: { 'Content-Type': 'application/json' } });

test('normalises and caches catalogues but never silently drops failed fetches', async () => {
  let calls = 0;
  const client = createKmbClient({ fetchImpl: async () => { calls++; return response([stop]); } });
  assert.equal((await client.getStops())[0].latitude, 22.3);
  await client.getStops();
  assert.equal(calls, 1);
});
test('route-stop join retains repeated sequences and destination', async () => {
  const client = createKmbClient({ fetchImpl: async url => response(/\/route\/?$/.test(url) ? [route] : [...[1, 20].map(seq => ({ ...route, stop: stopId, seq })), { ...route, stop: '1111111111111111', seq: 30 }]) });
  const routes = await client.getRoutesForStop(stopId);
  assert.deepEqual(routes.map(r => r.stopSequence), [1, 20]);
  assert.equal(routes[0].destination.en, 'Destination');
});
test('catalogue requests use the working collection URLs with trailing slash', async () => {
  const client = createKmbClient({ fetchImpl: async url => {
    if (url.endsWith('/route/')) return response([route]);
    if (url.endsWith('/route-stop/')) return response([{ ...route, stop: stopId, seq: 1 }, { ...route, stop: '1111111111111111', seq: 2 }]);
    return new Response('Collection URL rejected', { status: 403 });
  } });
  assert.equal((await client.getRoutesForStop(stopId)).length, 1);
});
test('terminal arrivals are not offered as boardable services', async () => {
  const client = createKmbClient({ fetchImpl: async url => response(url.endsWith('/route/') ? [route] : [
    { ...route, stop: '1111111111111111', seq: 1 }, { ...route, stop: stopId, seq: 25 }
  ]) });
  assert.deepEqual(await client.getRoutesForStop(stopId), []);
});
test('ETA URL uses selected service, passes signal, and is not cached', async () => {
  const urls = [];
  const client = createKmbClient({ fetchImpl: async (url, init) => { assert.ok(init.signal); urls.push(url); return response([]); } });
  const selection = { stopId, route: '1', serviceType: '2', direction: 'I', stopSequence: 25 };
  await client.getEta(selection); await client.getEta(selection);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].endsWith(`/eta/${stopId}/1/2`));
});
test('HTTP, malformed payload and abort have distinct errors', async () => {
  await assert.rejects(createKmbClient({ retries: 0, fetchImpl: async () => new Response('', { status: 503 }) }).getStops(), { code: 'HTTP_ERROR' });
  await assert.rejects(createKmbClient({ fetchImpl: async () => response({}) }).getStops(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createKmbClient({ retries: 0, fetchImpl: async () => { throw new TypeError('offline'); } }).getStops(), { code: 'NETWORK_ERROR' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createKmbClient({ fetchImpl: async () => { assert.fail('must not fetch'); } }).getStops({ signal: controller.signal }), { code: 'ABORTED' });
});
test('request timeout is bounded even when transport ignores cancellation', async () => {
  await assert.rejects(createKmbClient({ retries: 0, timeoutMs: 10, fetchImpl: () => new Promise(() => {}) }).getStops(), { code: 'TIMEOUT' });
});

function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}

test('an intermittent browser network/CORS failure retries and recovers', async () => {
  const modes = [];
  const client = createKmbClient({ storage: null, retryDelayMs: 0, fetchImpl: async (url, init) => {
    modes.push(init.cache);
    if (modes.length === 1) throw new TypeError('Failed to fetch');
    return response([stop]);
  } });
  assert.equal((await client.getStops())[0].id, stopId);
  assert.deepEqual(modes, ['default', 'reload']);
});

test('persistent network failures stop after the retry limit', async () => {
  let calls = 0;
  const client = createKmbClient({ storage: null, retryDelayMs: 0, fetchImpl: async () => { calls++; throw new TypeError('Load failed'); } });
  await assert.rejects(client.getStops(), { code: 'NETWORK_ERROR' });
  assert.equal(calls, 3);
});

test('only transient HTTP failures retry; invalid data and permanent HTTP failures do not', async () => {
  for (const status of [408, 429, 503, 404]) {
    let calls = 0;
    const client = createKmbClient({ storage: null, retryDelayMs: 0, fetchImpl: async () => { calls++; return new Response('', { status }); } });
    await assert.rejects(client.getStops(), { code: 'HTTP_ERROR' });
    assert.equal(calls, status === 404 ? 1 : 3);
  }
  let calls = 0;
  await assert.rejects(createKmbClient({ storage: null, retryDelayMs: 0, fetchImpl: async () => { calls++; return response({}); } }).getStops(), { code: 'INVALID_RESPONSE' });
  assert.equal(calls, 1);
});

test('cancelling during retry backoff stops further requests', async () => {
  let calls = 0;
  const controller = new AbortController();
  const client = createKmbClient({ storage: null, retryDelayMs: 100, fetchImpl: async () => {
    calls++; setTimeout(() => controller.abort(), 0); throw new TypeError('offline');
  } });
  await assert.rejects(client.getStops({ signal: controller.signal }), { code: 'ABORTED' });
  assert.equal(calls, 1);
});

test('recent public catalogues survive reload, expire, and can be cleared', async () => {
  const storage = memoryStorage();
  let clock = 1000, calls = 0;
  const options = { storage, now: () => clock, catalogueTtlMs: 100, retries: 0,
    fetchImpl: async () => { calls++; return response([stop]); } };
  await createKmbClient(options).getStops();
  clock = 1050;
  assert.equal((await createKmbClient(options).getStops())[0].id, stopId);
  assert.equal(calls, 1);
  clock = 1100;
  const client = createKmbClient(options);
  await client.getStops();
  assert.equal(calls, 2);
  client.clearCache();
  await createKmbClient(options).getStops();
  assert.equal(calls, 3);
});

test('expired or malformed cached catalogues never hide a live failure', async () => {
  for (const raw of ['broken JSON', JSON.stringify({ time: 5000, value: { data: [stop] } }), JSON.stringify({ time: 0, value: { data: [stop] } })]) {
    const storage = memoryStorage();
    storage.setItem('bus-o-clock.kmb-catalogue.v1:stop', raw);
    const client = createKmbClient({ storage, now: () => 1000, catalogueTtlMs: 100, retries: 0, fetchImpl: async () => { throw new TypeError('offline'); } });
    await assert.rejects(client.getStops(), { code: 'NETWORK_ERROR' });
  }
});

test('storage denied or full does not block loading valid live data', async () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  assert.equal((await createKmbClient({ storage, fetchImpl: async () => response([stop]) }).getStops())[0].id, stopId);
});

test('malformed stored rows are discarded and replaced by validated live data', async () => {
  const storage = memoryStorage();
  storage.setItem('bus-o-clock.kmb-catalogue.v1:stop', JSON.stringify({ time: 1000, value: { data: [{ ...stop, lat: 'invalid' }] } }));
  const client = createKmbClient({ storage, now: () => 1050, fetchImpl: async () => response([stop]) });
  assert.equal((await client.getStops())[0].latitude, 22.3);
  assert.equal(JSON.parse(storage.getItem('bus-o-clock.kmb-catalogue.v1:stop')).value.data[0].lat, '22.3');
});

test('ETA always uses live requests, including after reload and retries', async () => {
  const storage = memoryStorage(), modes = [];
  const selection = { stopId, route: '1', serviceType: '1', direction: 'O', stopSequence: 1 };
  const options = { storage, retryDelayMs: 0, fetchImpl: async (url, init) => {
    modes.push(init.cache);
    if (modes.length === 1) throw new TypeError('offline');
    return response([]);
  } };
  await createKmbClient(options).getEta(selection);
  await createKmbClient(options).getEta(selection);
  assert.deepEqual(modes, ['no-store', 'no-store', 'no-store']);
});

test('fresh same-site official catalogues work without a cross-origin request; ETA stays live', async () => {
  const urls = [], stamp = new Date().toISOString();
  const client = createKmbClient({ storage: null, catalogueBaseUrl: 'https://example.test/bus/data/', fetchImpl: async url => {
    urls.push(url);
    return new Response(JSON.stringify(url.includes('/data/')
      ? { snapshot_retrieved_at: stamp, generated_timestamp: stamp, data: [stop] }
      : { generated_timestamp: stamp, data: [] }));
  } });
  assert.equal((await client.getStops())[0].id, stopId);
  await client.getEta({ stopId, route: '1', serviceType: '1', direction: 'O', stopSequence: 1 });
  assert.deepEqual(urls, ['https://example.test/bus/data/stop.json', `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/1/1`]);
});

test('missing, malformed, or expired same-site catalogues fall back to the official API', async () => {
  for (const snapshot of [null, { data: [stop] }, { snapshot_retrieved_at: '2020-01-01', generated_timestamp: '2020-01-01', data: [stop] }]) {
    const urls = [];
    const client = createKmbClient({ storage: null, catalogueBaseUrl: 'https://example.test/data/', fetchImpl: async url => {
      urls.push(url);
      if (url.startsWith('https://example.test/')) return new Response(JSON.stringify(snapshot), { status: snapshot ? 200 : 404 });
      return response([stop]);
    } });
    assert.equal((await client.getStops())[0].id, stopId);
    assert.equal(urls.length, 2);
    assert.ok(urls[1].startsWith('https://data.etabus.gov.hk/'));
  }
});

test('invalid stop coordinates are upstream errors and a retry can recover', async () => {
  for (const lat of ['   ', 'not-a-number', '91']) {
    let calls = 0;
    const client = createKmbClient({ fetchImpl: async () => response([{ ...stop, lat: ++calls === 1 ? lat : stop.lat }]) });
    await assert.rejects(client.getStops(), { code: 'INVALID_RESPONSE' });
    assert.equal((await client.getStops())[0].latitude, 22.3);
    assert.equal(calls, 2);
  }
});
