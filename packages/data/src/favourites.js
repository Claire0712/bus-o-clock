import { DataError, requireValue, validateCommute } from './validation.js';
export const FAVOURITES_KEY = 'bus-o-clock.favourites.v1';

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function sanitise(value) {
  validateCommute(value);
  requireValue(typeof value.label === 'string' && value.label.trim().length > 0 && value.label.length <= 100, 'A label of 1 to 100 characters is required.');
  return { id: [value.stopId, value.route, value.direction, value.serviceType, value.stopSequence].join(':'),
    label: value.label.trim(), stopId: value.stopId, route: value.route, direction: value.direction,
    serviceType: value.serviceType, stopSequence: value.stopSequence,
    walkMinutes: value.walkMinutes, bufferMinutes: value.bufferMinutes };
}

export function createFavouriteStore({ storage = browserStorage() } = {}) {
  function load() {
    let raw;
    try {
      if (!storage) throw new Error('No storage');
      raw = storage.getItem(FAVOURITES_KEY);
    } catch { return { status: 'unavailable', favourites: [] }; }
    if (raw === null) return { status: 'ok', favourites: [] };
    try {
      const value = JSON.parse(raw);
      if (value.version !== 1 || !Array.isArray(value.favourites)) throw new Error('Unknown storage schema');
      const favourites = value.favourites.map(sanitise);
      if (new Set(favourites.map(f => f.id)).size !== favourites.length) throw new Error('Duplicate favourites');
      return { status: 'ok', favourites };
    } catch { return { status: 'corrupt', favourites: [] }; }
  }
  function existing() {
    const result = load();
    if (result.status !== 'ok') throw new DataError(result.status === 'corrupt' ? 'STORAGE_CORRUPT' : 'STORAGE_UNAVAILABLE', 'Favourites cannot be read. Existing data was not overwritten.');
    return result.favourites;
  }
  function write(favourites) {
    try { storage.setItem(FAVOURITES_KEY, JSON.stringify({ version: 1, favourites })); }
    catch (error) { throw new DataError('STORAGE_UNAVAILABLE', 'Favourites could not be saved.', error); }
  }
  return {
    load,
    save(value) {
      const favourite = sanitise(value);
      const favourites = existing();
      const index = favourites.findIndex(f => f.id === favourite.id);
      if (index < 0) favourites.push(favourite); else favourites[index] = favourite;
      write(favourites);
      return favourite;
    },
    remove(id) { write(existing().filter(f => f.id !== id)); }
  };
}
