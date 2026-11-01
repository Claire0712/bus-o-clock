import test from 'node:test';
import assert from 'node:assert/strict';
import { createBusOClock, watchCommute } from '../src/commute.js';

const selection = { stopId: '18492910339410B1', route: '1', direction: 'O', serviceType: '1', stopSequence: 1, walkMinutes: 4, bufferMinutes: 2 };
const now = Date.parse('2026-11-01T08:00:00+08:00');
const payload = { generated_timestamp: new Date(now).toISOString(), data: [{ route: '1', dir: 'O', service_type: 1, seq: 1, eta: new Date(now + 480_000).toISOString(), data_timestamp: new Date(now).toISOString() }] };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('facade locates nearby stops and accepts a manual point without requesting permission', async () => {
  let locationCalls = 0;
  const service = createBusOClock({ client: { getStops: async () => [{ id: selection.stopId, latitude: 22.3, longitude: 114.2 }] },
    locationProvider: async () => { locationCalls++; return { latitude: 22.3, longitude: 114.2, accuracyMeters: 10 }; } });
  assert.equal((await service.getNearbyStops()).locationSource, 'device');
  assert.equal((await service.getNearbyStops({ point: { latitude: 22.3, longitude: 114.2 } })).locationSource, 'manual');
  assert.equal(locationCalls, 1);
});
test('watcher emits loading and advice, suppresses advice on refresh failure, and recovers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let calls = 0;
  const states = [];
  const client = { getEta: async () => { calls++; if (calls === 2) throw new Error('offline'); return payload; } };
  const stop = watchCommute({ client, selection, now: () => now, onUpdate: state => states.push(state) });
  assert.equal(states[0].status, 'loading');
  await settle();
  assert.equal(states.at(-1).leaveInSeconds, 120);
  t.mock.timers.tick(60_000); await settle();
  assert.equal(states.at(-1).status, 'error');
  assert.equal(states.at(-1).recommended, null);
  t.mock.timers.tick(60_000); await settle();
  assert.equal(states.at(-1).status, 'wait');
  stop();
  const length = states.length;
  t.mock.timers.tick(120_000); await settle();
  assert.equal(calls, 3);
  assert.equal(states.length, length);
});
test('disposing a watcher aborts its in-flight request and ignores late results', async () => {
  let release; let signal;
  const states = [];
  const stop = watchCommute({ selection, now: () => now, onUpdate: state => states.push(state), client: { getEta: (s, options) => {
    signal = options.signal; return new Promise(resolve => { release = resolve; });
  } } });
  stop(); release(payload); await settle();
  assert.equal(signal.aborted, true);
  assert.deepEqual(states.map(s => s.status), ['loading']);
});
test('watcher ages advice out even while a refresh is stalled', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let currentTime = now;
  let calls = 0;
  const states = [];
  const stop = watchCommute({ selection, now: () => currentTime, onUpdate: s => states.push(s), client: { getEta: () => ++calls === 1 ? Promise.resolve(payload) : new Promise(() => {}) } });
  await settle();
  currentTime += 121_000;
  t.mock.timers.tick(121_000); await settle();
  assert.equal(states.at(-1).status, 'stale');
  assert.equal(states.at(-1).leaveInSeconds, null);
  stop();
});
