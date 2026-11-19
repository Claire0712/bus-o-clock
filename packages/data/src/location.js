import { DataError, requireValue, validatePoint } from './validation.js';

export function distanceMeters(a, b) {
  validatePoint(a); validatePoint(b);
  const rad = degrees => degrees * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function nearbyStops(stops, point, { radiusMeters = 1000, limit = 20 } = {}) {
  validatePoint(point);
  requireValue(Number.isFinite(radiusMeters) && radiusMeters >= 0 && Number.isInteger(limit) && limit > 0, 'Invalid nearby search radius or limit.');
  return stops.map(stop => ({ ...stop, distanceMeters: distanceMeters(point, stop) }))
    .filter(stop => stop.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id)).slice(0, limit);
}

function normalisePosition(position) {
  const point = { latitude: position?.coords?.latitude, longitude: position?.coords?.longitude };
  validatePoint(point);
  return { ...point, accuracyMeters: position.coords.accuracy, timestamp: position.timestamp };
}

export async function getCurrentLocation({ geolocation = globalThis.navigator?.geolocation, timeoutMs = 30_000 } = {}) {
  requireValue(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Invalid location timeout.');
  if (!geolocation) throw new DataError('LOCATION_UNAVAILABLE', 'Location is not supported in this window. Open the app in your browser or enter coordinates manually.');
  const request = enableHighAccuracy => new Promise((resolve, reject) => {
    // Let the browser time position acquisition. A separate wall-clock timer
    // also counts time spent reading the permission prompt and rejects too early.
    // https://www.w3.org/TR/geolocation/#timeout-member
    geolocation.getCurrentPosition(position => {
      try { resolve(normalisePosition(position)); } catch (error) { reject(error); }
    }, error => {
      const code = ({ 1: 'LOCATION_DENIED', 2: 'LOCATION_UNAVAILABLE', 3: 'LOCATION_TIMEOUT' })[error.code] ?? 'LOCATION_UNAVAILABLE';
      const messages = {
        LOCATION_DENIED: 'Location access is blocked. Allow location for this website and browser in your device settings, then try again. Permissions in another browser do not apply here.',
        LOCATION_UNAVAILABLE: 'The browser could not determine your position. Check device Location Services and Wi-Fi, then retry or enter coordinates manually.',
        LOCATION_TIMEOUT: 'The location service did not return a position within the allowed time. Try again or enter coordinates manually.'
      };
      reject(new DataError(code, messages[code], error));
    }, { enableHighAccuracy, maximumAge: 30_000, timeout: timeoutMs / 2 });
  });
  try {
    return await request(true);
  } catch (error) {
    // A temporary provider failure can recover on a second acquisition.
    // Never retry a denial or substitute a public example for device location.
    if (!['LOCATION_UNAVAILABLE', 'LOCATION_TIMEOUT'].includes(error.code)) throw error;
    await new Promise(resolve => setTimeout(resolve, 750));
    // Let the browser use its normal accuracy mode for this final attempt.
    // Preserve the reported accuracy so callers can show the uncertainty.
    return request(false);
  }
}

// Inject @capacitor/geolocation only in the native app; no dependency for web users.
export function createCapacitorLocationProvider(plugin) {
  return async () => {
    try {
      let permission = await plugin.checkPermissions();
      const allowed = p => p.location === 'granted' || p.coarseLocation === 'granted';
      if (!allowed(permission)) permission = await plugin.requestPermissions({ permissions: ['location'] });
      if (!allowed(permission)) throw new DataError('LOCATION_DENIED', 'Location permission was denied.');
      let timer;
      try {
        const timeout = new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new DataError('LOCATION_TIMEOUT', 'Native location request timed out. Select a point manually.')), 10_000);
        });
        return normalisePosition(await Promise.race([
          plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }), timeout
        ]));
      } finally { clearTimeout(timer); }
    } catch (error) {
      if (error instanceof DataError) throw error;
      const code = error.code === 'OS-PLUG-GLOC-0003' ? 'LOCATION_DENIED'
        : error.code === 'OS-PLUG-GLOC-0010' ? 'LOCATION_TIMEOUT' : 'LOCATION_UNAVAILABLE';
      throw new DataError(code, 'Native location is unavailable. Select a point manually.', error);
    }
  };
}
