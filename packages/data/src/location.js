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

export async function getCurrentLocation({ geolocation = globalThis.navigator?.geolocation, timeoutMs = 10_000 } = {}) {
  requireValue(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Invalid location timeout.');
  if (!geolocation) throw new DataError('LOCATION_UNAVAILABLE', 'Geolocation is unavailable. Use HTTPS/localhost or select a point manually.');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DataError('LOCATION_TIMEOUT', 'Location request timed out.')), timeoutMs);
    geolocation.getCurrentPosition(position => {
      clearTimeout(timer);
      try { resolve(normalisePosition(position)); } catch (error) { reject(error); }
    }, error => {
      clearTimeout(timer);
      const code = ({ 1: 'LOCATION_DENIED', 2: 'LOCATION_UNAVAILABLE', 3: 'LOCATION_TIMEOUT' })[error.code] ?? 'LOCATION_UNAVAILABLE';
      reject(new DataError(code, 'Could not obtain location. You can select a point manually.', error));
    }, { enableHighAccuracy: true, maximumAge: 30_000, timeout: timeoutMs });
  });
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
