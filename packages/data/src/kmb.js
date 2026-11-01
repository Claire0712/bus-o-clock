import { DataError, names, requireValue, validatePoint, validateSelection } from './validation.js';
export const KMB_BASE_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';

function normaliseStop(row) {
  if (!row || typeof row.lat !== 'string' && typeof row.lat !== 'number'
    || typeof row.long !== 'string' && typeof row.long !== 'number' || row.lat === '' || row.long === '') {
    throw new DataError('INVALID_RESPONSE', 'Invalid stop coordinates.');
  }
  const stop = { id: row.stop, name: names(row, 'name'), latitude: Number(row.lat), longitude: Number(row.long) };
  validatePoint(stop);
  requireValue(/^[A-F0-9]{16}$/.test(stop.id), 'Invalid stop ID.');
  return stop;
}

export function createKmbClient({ fetchImpl = globalThis.fetch, timeoutMs = 10_000, catalogueTtlMs = 3_600_000, now = Date.now } = {}) {
  requireValue(typeof fetchImpl === 'function' && Number.isFinite(timeoutMs) && timeoutMs > 0, 'Fetch and a positive timeout are required.');
  const cache = new Map();
  async function request(path, { signal, catalogue = false } = {}) {
    if (signal?.aborted) throw new DataError('ABORTED', 'Request cancelled.');
    const cached = cache.get(path);
    if (catalogue && cached && now() - cached.time < catalogueTtlMs) return structuredClone(cached.value);
    const controller = new AbortController();
    let timer;
    let onAbort;
    const interrupted = new Promise((resolve, reject) => {
      onAbort = () => { controller.abort(); reject(new DataError('ABORTED', 'Request cancelled.')); };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new DataError('TIMEOUT', 'KMB request timed out.')); }, timeoutMs);
    });
    try {
      const work = (async () => {
        const response = await fetchImpl(`${KMB_BASE_URL}/${path}`, { signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) throw new DataError('HTTP_ERROR', `KMB returned HTTP ${response.status}.`);
        let value;
        try { value = await response.json(); } catch (error) { throw new DataError('INVALID_RESPONSE', 'KMB returned invalid JSON.', error); }
        if (!Array.isArray(value?.data)) throw new DataError('INVALID_RESPONSE', 'KMB response must contain a data array.');
        return value;
      })();
      const value = await Promise.race([work, interrupted]);
      if (catalogue) cache.set(path, { value: structuredClone(value), time: now() });
      return value;
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw new DataError('NETWORK_ERROR', 'Could not reach KMB. Check your connection.', error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  return {
    async getStops(options = {}) {
      const envelope = await request('stop', { ...options, catalogue: true });
      return envelope.data.map(normaliseStop);
    },
    async getRoutesForStop(stopId, options = {}) {
      requireValue(/^[A-F0-9]{16}$/.test(stopId), 'Invalid stop ID.');
      const [routes, associations] = await Promise.all([
        request('route/', { ...options, catalogue: true }), request('route-stop/', { ...options, catalogue: true })
      ]);
      const key = r => [r.route, r.bound, r.service_type].join(':');
      const metadata = new Map(routes.data.map(r => [key(r), r]));
      const lastSequence = new Map();
      for (const row of associations.data) lastSequence.set(key(row), Math.max(lastSequence.get(key(row)) ?? 0, Number(row.seq)));
      // ETA also reports buses arriving at their terminus; those are not boarding services.
      return associations.data.filter(r => r.stop === stopId && Number(r.seq) < lastSequence.get(key(r))).map(r => {
        const route = metadata.get(key(r));
        if (!route) throw new DataError('INVALID_RESPONSE', 'Route catalogue and stop associations do not match.');
        const result = { stopId, route: r.route, direction: r.bound, serviceType: String(r.service_type),
          stopSequence: Number(r.seq), origin: names(route, 'orig'), destination: names(route, 'dest') };
        validateSelection(result);
        return result;
      }).sort((a, b) => a.route.localeCompare(b.route, 'en', { numeric: true }) || a.direction.localeCompare(b.direction) || a.stopSequence - b.stopSequence);
    },
    getEta(selection, options = {}) {
      validateSelection(selection);
      return request(`eta/${selection.stopId}/${selection.route}/${selection.serviceType}`, options);
    },
    clearCache() { cache.clear(); }
  };
}
