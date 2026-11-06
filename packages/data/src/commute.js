import { calculateDeparture } from './departures.js';
import { createKmbClient } from './kmb.js';
import { getCurrentLocation, nearbyStops } from './location.js';
import { createFavouriteStore } from './favourites.js';
import { DataError, validateCommute } from './validation.js';

export function createBusOClock({ client = createKmbClient(), locationProvider = getCurrentLocation, favouriteStore = createFavouriteStore() } = {}) {
  return {
    client,
    favourites: favouriteStore,
    async getNearbyStops({ point, radiusMeters = 1000, limit = 20, signal } = {}) {
      // Request permission before downloading the catalogue. Manual mode never prompts.
      checkCancellation(signal);
      const location = point ?? await locate(locationProvider, signal);
      checkCancellation(signal);
      const stops = await client.getStops({ signal });
      return { location, locationSource: point ? 'manual' : 'device', stops: nearbyStops(stops, location, { radiusMeters, limit }) };
    },
    getRoutesForStop: (stopId, options) => client.getRoutesForStop(stopId, options),
    async getCommute(selection, { signal, now } = {}) {
      validateCommute(selection);
      const envelope = await client.getEta(selection, { signal });
      return calculateDeparture(envelope, selection, { now });
    },
    watchCommute: (selection, onUpdate) => watchCommute({ client, selection, onUpdate })
  };
}

// Foreground only. Call the returned cleanup on unmount, selection change or app background.
export function watchCommute({ client, selection, onUpdate, now = Date.now }) {
  validateCommute(selection);
  const commute = { ...selection };
  const controller = new AbortController();
  let disposed = false;
  let envelope = null;
  let error = null;
  let refreshing = false;
  let refreshTimer;
  const empty = status => ({ status, recommended: null, leaveInSeconds: null, departures: [], skippedCount: 0,
    generatedAt: null, updatedAt: null, evaluatedAt: new Date(now()).toISOString(), remarks: [], staleCount: 0 });
  function emit() {
    if (disposed) return;
    const state = error ? { ...empty('error'), error: { code: error.code ?? 'NETWORK_ERROR', message: error.message } }
      : envelope ? calculateDeparture(envelope, commute, { now: now() }) : empty('loading');
    onUpdate({ ...state, refreshing });
  }
  async function refresh() {
    refreshing = true;
    emit();
    try {
      const value = await client.getEta(commute, { signal: controller.signal });
      // Validate before publishing; a bad response must clear earlier advice.
      calculateDeparture(value, commute, { now: now() });
      if (!disposed) { envelope = value; error = null; }
    } catch (failure) {
      if (!disposed) { error = failure; envelope = null; }
    }
    if (disposed) return;
    refreshing = false;
    emit();
    // No overlapping requests; one-minute interval starts after completion.
    refreshTimer = setTimeout(refresh, 60_000);
  }
  const tickTimer = setInterval(emit, 1000);
  void refresh();
  return () => {
    disposed = true;
    controller.abort();
    clearInterval(tickTimer);
    clearTimeout(refreshTimer);
  };
}

function checkCancellation(signal) {
  if (signal?.aborted) throw new DataError('ABORTED', 'Nearby search was cancelled.');
}

// Permission UI cannot be dismissed programmatically; stop waiting and discard late results.
function locate(provider, signal) {
  if (!signal) return provider();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DataError('ABORTED', 'Nearby search was cancelled.'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      checkCancellation(signal);
      return provider();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
