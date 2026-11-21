import { DataError, names, requireValue, validateCommute } from './validation.js';

// Policy, not an operator guarantee: stop giving advice after two minutes.
export const DEFAULT_MAX_AGE_MS = 120_000;

export function calculateDeparture(envelope, selection, { now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  validateCommute(selection);
  requireValue(Number.isFinite(now) && Number.isFinite(maxAgeMs) && maxAgeMs > 0, 'Invalid time or freshness threshold.');
  if (!Array.isArray(envelope?.data)) throw new DataError('INVALID_RESPONSE', 'ETA response must contain a data array.');
  const generated = Date.parse(envelope.generated_timestamp);
  const fresh = timestamp => Number.isFinite(timestamp) && now - timestamp <= maxAgeMs && timestamp - now <= 60_000;
  const selected = envelope.data.filter(row => row && row.route === selection.route && row.dir === selection.direction
    && String(row.service_type) === selection.serviceType && Number(row.seq) === selection.stopSequence
    && (!row.stop || row.stop === selection.stopId) && (!row.co || row.co === 'KMB'));
  const remarks = selected.map(row => names(row, 'rmk')).filter(r => r.en || r.tc || r.sc);
  const base = {
    status: 'no-service', recommended: null, leaveInSeconds: null, departures: [], skippedCount: 0,
    generatedAt: Number.isFinite(generated) ? new Date(generated).toISOString() : null,
    updatedAt: null, evaluatedAt: new Date(now).toISOString(), remarks,
    staleCount: 0
  };
  if (!fresh(generated)) return { ...base, status: 'stale' };
  const validRows = selected.filter(row => fresh(Date.parse(row.data_timestamp)));
  base.staleCount = selected.length - validRows.length;
  if (selected.length && !validRows.length) return { ...base, status: 'stale' };
  if (validRows.length) base.updatedAt = new Date(Math.min(...validRows.map(row => Date.parse(row.data_timestamp)))).toISOString();

  const seen = new Set();
  const departures = validRows.flatMap(row => {
    const arrival = Date.parse(row.eta);
    if (!Number.isFinite(arrival) || arrival < now || seen.has(arrival)) return [];
    seen.add(arrival);
    const leaveAt = arrival - (selection.walkMinutes + selection.bufferMinutes) * 60_000;
    return [{ eta: new Date(arrival).toISOString(), leaveAt: new Date(leaveAt).toISOString(),
      arrivalInSeconds: Math.floor((arrival - now) / 1000), leaveInSeconds: Math.floor((leaveAt - now) / 1000),
      catchable: leaveAt >= now, scheduled: /scheduled/i.test(row.rmk_en ?? '') || /原定班次/.test(row.rmk_tc ?? ''),
      destination: names(row, 'dest'), remark: names(row, 'rmk'), updatedAt: new Date(Date.parse(row.data_timestamp)).toISOString() }];
  }).sort((a, b) => Date.parse(a.eta) - Date.parse(b.eta));
  const recommended = departures.find(d => d.catchable) ?? null;
  const status = recommended ? (recommended.leaveInSeconds <= 60 ? 'leave-now' : 'wait') : (departures.length ? 'too-late' : 'no-service');
  return { ...base, status, departures, recommended, leaveInSeconds: recommended?.leaveInSeconds ?? null,
    skippedCount: departures.filter(d => !d.catchable).length };
}
