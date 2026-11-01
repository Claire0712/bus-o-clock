import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeparture } from '../src/departures.js';

const now = Date.parse('2026-11-01T23:58:00+08:00');
const iso = (minutes) => new Date(now + minutes * 60_000).toISOString();
const selection = { stopId: '18492910339410B1', route: '1', direction: 'O', serviceType: '1', stopSequence: 1, walkMinutes: 4, bufferMinutes: 2 };
const row = (minutes, extra = {}) => ({ co: 'KMB', route: '1', dir: 'O', service_type: 1, seq: 1, eta_seq: 1, eta: iso(minutes), data_timestamp: iso(0), rmk_en: '', ...extra });
const envelope = (rows, extra = {}) => ({ generated_timestamp: iso(0), data: rows, ...extra });
const calc = (rows, options = {}) => calculateDeparture(envelope(rows), selection, { now, ...options });

test('skips a too-soon bus and calculates departure across midnight', () => {
  const result = calc([row(3), row(8, { eta_seq: 2 })]);
  assert.equal(result.status, 'wait');
  assert.equal(result.recommended.eta, iso(8));
  assert.equal(result.leaveInSeconds, 120);
  assert.equal(result.skippedCount, 1);
});
test('filters opposite direction, service type and repeated stop sequence', () => {
  const result = calc([row(7, { dir: 'I' }), row(8, { service_type: 2 }), row(9, { seq: 20 }), row(10)]);
  assert.equal(result.departures.length, 1);
  assert.equal(result.leaveInSeconds, 240);
});
test('exact departure boundary is leave-now, without negative countdown', () => {
  assert.equal(calc([row(6)]).status, 'leave-now');
  assert.equal(calc([row(6)]).leaveInSeconds, 0);
  assert.equal(calc([row(6.5)]).status, 'leave-now');
});
test('all future buses too soon produces too-late, not a rush recommendation', () => {
  const result = calc([row(2), row(5)]);
  assert.equal(result.status, 'too-late');
  assert.equal(result.recommended, null);
});
test('null ETA preserves service remarks and does not invent an arrival', () => {
  const result = calc([row(0, { eta: null, rmk_en: 'Last bus departed' })]);
  assert.equal(result.status, 'no-service');
  assert.ok(result.remarks.some(r => r.en === 'Last bus departed'));
  assert.equal(result.leaveInSeconds, null);
});
test('fresh response cannot hide stale per-bus data', () => {
  assert.equal(calc([row(10, { data_timestamp: iso(-3) })]).status, 'stale');
});
test('old envelope, absent timestamps and future clock skew suppress advice', () => {
  assert.equal(calculateDeparture(envelope([row(10)], { generated_timestamp: iso(-3) }), selection, { now }).status, 'stale');
  assert.equal(calc([row(10, { data_timestamp: undefined })]).status, 'stale');
  assert.equal(calc([row(10, { data_timestamp: iso(5) })]).status, 'stale');
});
test('scheduled buses are explicitly labelled and duplicate ETA rows collapse', () => {
  const result = calc([row(10, { rmk_en: 'Scheduled Bus' }), row(10, { rmk_en: 'Scheduled Bus' })]);
  assert.equal(result.departures.length, 1);
  assert.equal(result.recommended.scheduled, true);
});
test('invalid durations and missing direction are rejected', () => {
  for (const patch of [{ walkMinutes: -1 }, { bufferMinutes: NaN }, { direction: undefined }, { stopSequence: 0 }]) {
    assert.throws(() => calculateDeparture(envelope([row(8)]), { ...selection, ...patch }, { now }), { code: 'INVALID_INPUT' });
  }
});
test('countdown becomes stale with time even without another network request', () => {
  assert.equal(calc([row(10)], { now: now + 121_000 }).status, 'stale');
});
