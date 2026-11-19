import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, nearbyStops, getCurrentLocation, createCapacitorLocationProvider } from '../src/location.js';

test('distance uses metres and nearest search honours radius and limit', () => {
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111195) < 2);
  const stops = [{ id: 'far', latitude: 0, longitude: 1 }, { id: 'near', latitude: 0, longitude: 0.001 }, { id: 'here', latitude: 0, longitude: 0 }];
  assert.deepEqual(nearbyStops(stops, { latitude: 0, longitude: 0 }, { radiusMeters: 500, limit: 1 }).map(s => s.id), ['here']);
  assert.equal(stops[0].distanceMeters, undefined);
});
test('invalid coordinates are rejected rather than treated as the equator', () => {
  assert.throws(() => distanceMeters({ latitude: null, longitude: 0 }, { latitude: 0, longitude: 0 }), { code: 'INVALID_INPUT' });
});
test('browser location returns accuracy and normalises permission denial', async () => {
  const location = await getCurrentLocation({ geolocation: { getCurrentPosition(ok) { ok({ coords: { latitude: 22.3, longitude: 114.2, accuracy: 25 }, timestamp: 100 }); } } });
  assert.equal(location.accuracyMeters, 25);
  await assert.rejects(getCurrentLocation({ geolocation: { getCurrentPosition(ok, fail) { fail({ code: 1 }); } } }), { code: 'LOCATION_DENIED' });
  await assert.rejects(getCurrentLocation({ geolocation: null }), { code: 'LOCATION_UNAVAILABLE' });
});
test('waiting for browser permission does not consume the acquisition timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let complete;
  const outcome = getCurrentLocation({ timeoutMs: 10_000, geolocation: {
    getCurrentPosition(ok) { complete = ok; }
  } }).then(() => 'success', error => error.code);
  t.mock.timers.tick(15_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await Promise.race([outcome, Promise.resolve('pending')]), 'pending');
  complete({ coords: { latitude: 22.3, longitude: 114.2, accuracy: 25 }, timestamp: 100 });
  assert.equal(await outcome, 'success');
});
test('browser acquisition timeout and unavailable service remain distinct errors', async () => {
  for (const [browserCode, code] of [[2, 'LOCATION_UNAVAILABLE'], [3, 'LOCATION_TIMEOUT']]) {
    const providerError = { code: browserCode, message: 'Provider could not return a position' };
    await assert.rejects(getCurrentLocation({ geolocation: {
      getCurrentPosition(ok, fail, options) {
        assert.equal(options.timeout, 30_000);
        fail(providerError);
      }
    } }), error => error.code === code && error.cause === providerError);
  }
});
test('native adapter requests permission and preserves approximate location accuracy', async () => {
  let requested = false;
  const provider = createCapacitorLocationProvider({
    checkPermissions: async () => ({ location: 'prompt', coarseLocation: 'prompt' }),
    requestPermissions: async () => { requested = true; return { location: 'denied', coarseLocation: 'granted' }; },
    getCurrentPosition: async () => ({ coords: { latitude: 22.3, longitude: 114.2, accuracy: 900 }, timestamp: 100 })
  });
  assert.equal((await provider()).accuracyMeters, 900);
  assert.equal(requested, true);
});
test('native position request times out even when the plugin never settles', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const provider = createCapacitorLocationProvider({checkPermissions:async()=>({location:'granted'}),getCurrentPosition:()=>new Promise(()=>{})});
  const outcome = provider().then(()=> 'resolved', e=>e.code);
  await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(10001);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await Promise.race([outcome,Promise.resolve('pending')]),'LOCATION_TIMEOUT');
});
