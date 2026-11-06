import assert from 'node:assert/strict';
import { createKmbClient, nearbyStops, calculateDeparture } from '../src/index.js';

// Opt-in live check, separate from deterministic tests. No user location is used.
const client = createKmbClient({ timeoutMs: 20_000 });
const stops = await client.getStops();
assert.ok(stops.length > 100);
const stop = stops.find(s => s.id === '18492910339410B1');
assert.ok(stop, 'Known KMB stop should exist');
const nearby = nearbyStops(stops, stop, { radiusMeters: 500, limit: 5 });
assert.equal(nearby[0].distanceMeters, 0);
const routes = await client.getRoutesForStop(stop.id);
const route = routes.find(r => r.route === '1' && r.direction === 'O' && r.serviceType === '1');
assert.ok(route, 'Route 1 outbound should serve the selected stop');
const selection = { ...route, walkMinutes: 4, bufferMinutes: 2 };
const envelope = await client.getEta(selection);
const advice = calculateDeparture(envelope, selection);
assert.ok(['wait', 'leave-now', 'too-late', 'no-service', 'stale'].includes(advice.status));
assert.ok(envelope.data.every(r => r.route === '1'));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), stopCount: stops.length,
  stop: stop.name.en, nearbyCount: nearby.length, servicesAtStop: routes.length,
  selected: { route: route.route, direction: route.direction, serviceType: route.serviceType, stopSequence: route.stopSequence },
  responseRows: envelope.data.length, status: advice.status, departures: advice.departures.length,
  sourceGeneratedAt: advice.generatedAt, sourceUpdatedAt: advice.updatedAt, leaveInSeconds: advice.leaveInSeconds }, null, 2));
