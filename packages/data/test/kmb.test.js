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
  await assert.rejects(createKmbClient({ fetchImpl: async () => new Response('', { status: 503 }) }).getStops(), { code: 'HTTP_ERROR' });
  await assert.rejects(createKmbClient({ fetchImpl: async () => response({}) }).getStops(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createKmbClient({ fetchImpl: async () => { throw new TypeError('offline'); } }).getStops(), { code: 'NETWORK_ERROR' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createKmbClient({ fetchImpl: async () => { assert.fail('must not fetch'); } }).getStops({ signal: controller.signal }), { code: 'ABORTED' });
});
test('request timeout is bounded even when transport ignores cancellation', async () => {
  await assert.rejects(createKmbClient({ timeoutMs: 10, fetchImpl: () => new Promise(() => {}) }).getStops(), { code: 'TIMEOUT' });
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
