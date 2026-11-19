import { DataError, names, requireValue, validatePoint, validateSelection } from './validation.js';
export const KMB_BASE_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CATALOGUE_KEY = 'bus-o-clock.kmb-catalogue.v1:';
const CATALOGUE_PATHS = ['stop', 'route/', 'route-stop/'];

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DataError('ABORTED', 'Request cancelled.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { signal.removeEventListener('abort', abort); abort(); }
  });
}

function normaliseStop(row) {
  if (!row || typeof row.lat !== 'string' && typeof row.lat !== 'number'
    || typeof row.long !== 'string' && typeof row.long !== 'number' || String(row.lat).trim() === '' || String(row.long).trim() === '') {
    throw new DataError('INVALID_RESPONSE', 'Invalid stop coordinates.');
  }
  const stop = { id: row.stop, name: names(row, 'name'), latitude: Number(row.lat), longitude: Number(row.long) };
  validatePoint(stop);
  requireValue(/^[A-F0-9]{16}$/.test(stop.id), 'Invalid stop ID.');
  return stop;
}

function validateCatalogue(path, value) {
  try {
    for (const row of value.data) {
      if (path === 'stop') normaliseStop(row);
      else if (path === 'route-stop/') validateSelection({ stopId: row?.stop, route: row?.route,
        direction: row?.bound, serviceType: String(row?.service_type), stopSequence: Number(row?.seq) });
      else if (path === 'route/') requireValue(row && /^[A-Z0-9]{1,12}$/.test(row.route)
        && ['O', 'I'].includes(row.bound) && /^[1-9]\d*$/.test(String(row.service_type)), 'Invalid route.');
    }
  } catch (error) { throw new DataError('INVALID_RESPONSE', 'KMB returned an invalid catalogue.', error); }
}

export function createKmbClient({ fetchImpl = globalThis.fetch, timeoutMs = 10_000, catalogueTtlMs = 3_600_000,
  retries = 2, retryDelayMs = 750, storage = browserStorage(), catalogueBaseUrl = null, now = Date.now } = {}) {
  requireValue(typeof fetchImpl === 'function' && Number.isFinite(timeoutMs) && timeoutMs > 0, 'Fetch and a positive timeout are required.');
  requireValue(Number.isInteger(retries) && retries >= 0 && retries <= 3 && Number.isFinite(retryDelayMs) && retryDelayMs >= 0, 'Invalid retry settings.');
  requireValue(Number.isFinite(catalogueTtlMs) && catalogueTtlMs >= 0, 'Invalid catalogue lifetime.');
  const cache = new Map();
  function freshSnapshot(value) {
    const retrieved = Date.parse(value?.snapshot_retrieved_at), generated = Date.parse(value?.generated_timestamp);
    return [retrieved, generated].every(time => Number.isFinite(time) && time <= now() + 300_000 && now() - time < 36 * 3_600_000);
  }
  function remember(path, value) {
    const entry = { value: structuredClone(value), time: now() };
    cache.set(path, entry);
    try { storage?.setItem(CATALOGUE_KEY + path, JSON.stringify(entry)); } catch { /* Storage is optional. */ }
  }
  function forget(path) {
    cache.delete(path);
    try { storage?.removeItem(CATALOGUE_KEY + path); } catch { /* Storage is optional. */ }
  }
  function cachedCatalogue(path) {
    let entry = cache.get(path);
    if (!entry) {
      try { entry = JSON.parse(storage?.getItem(CATALOGUE_KEY + path) ?? 'null'); } catch { /* Ignore corrupt storage. */ }
    }
    if (entry && Number.isFinite(entry.time) && entry.time <= now() && now() - entry.time < catalogueTtlMs && Array.isArray(entry.value?.data)
      && (!entry.value.snapshot_retrieved_at || freshSnapshot(entry.value))) {
      try {
        validateCatalogue(path, entry.value);
        cache.set(path, entry);
        return structuredClone(entry.value);
      } catch { /* Refetch invalid stored rows instead of preserving them. */ }
    }
    forget(path);
    return null;
  }
  async function request(path, { signal, catalogue = false } = {}) {
    if (signal?.aborted) throw new DataError('ABORTED', 'Request cancelled.');
    const cached = catalogue && cachedCatalogue(path);
    if (cached) return cached;
    // Public daily catalogues can be served from our own site; ETA always uses KMB directly.
    if (catalogue && catalogueBaseUrl) {
      try {
        const url = new URL(`${path.replace(/\/$/, '')}.json`, catalogueBaseUrl).href;
        const snapshot = await requestOnce(path, { signal, catalogue, attempt: 0, url, requestTimeoutMs: Math.min(timeoutMs, 3000) });
        if (freshSnapshot(snapshot)) { remember(path, snapshot); return snapshot; }
      } catch (error) { if (error.code === 'ABORTED') throw error; }
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const value = await requestOnce(path, { signal, catalogue, attempt });
        if (catalogue) remember(path, value);
        return value;
      } catch (error) {
        const transient = ['NETWORK_ERROR', 'TIMEOUT'].includes(error.code)
          || error.code === 'HTTP_ERROR' && (error.status === 408 || error.status === 429 || error.status >= 500);
        if (!transient || attempt >= retries) throw error;
        await pause(retryDelayMs * (attempt + 1), signal);
      }
    }
  }
  async function requestOnce(path, { signal, catalogue, attempt, url = `${KMB_BASE_URL}/${path}`, requestTimeoutMs = timeoutMs }) {
    if (signal?.aborted) throw new DataError('ABORTED', 'Request cancelled.');
    const controller = new AbortController();
    let timer;
    let onAbort;
    const interrupted = new Promise((resolve, reject) => {
      onAbort = () => { controller.abort(); reject(new DataError('ABORTED', 'Request cancelled.')); };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new DataError('TIMEOUT', 'KMB request timed out.')); }, requestTimeoutMs);
    });
    try {
      const work = (async () => {
        const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' },
          cache: catalogue ? (attempt ? 'reload' : 'default') : 'no-store' });
        if (!response.ok) {
          const error = new DataError('HTTP_ERROR', `Bus data is temporarily unavailable (HTTP ${response.status}). Please try again.`);
          error.status = response.status;
          throw error;
        }
        let value;
        try { value = await response.json(); } catch (error) { throw new DataError('INVALID_RESPONSE', 'KMB returned invalid JSON.', error); }
        if (!Array.isArray(value?.data)) throw new DataError('INVALID_RESPONSE', 'KMB response must contain a data array.');
        if (catalogue) validateCatalogue(path, value);
        return value;
      })();
      const value = await Promise.race([work, interrupted]);
      return value;
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw new DataError('NETWORK_ERROR', 'Bus data could not be loaded after retrying. Please try again shortly.', error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  return {
    async getStops(options = {}) {
      const envelope = await request('stop', { ...options, catalogue: true });
      try { return envelope.data.map(normaliseStop); }
      catch (error) {
        // Do not retain malformed catalogue rows for the full cache TTL.
        forget('stop');
        throw new DataError('INVALID_RESPONSE', 'KMB returned an invalid stop catalogue.', error);
      }
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
    clearCache() { CATALOGUE_PATHS.forEach(forget); }
  };
}
