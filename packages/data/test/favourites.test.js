import test from 'node:test';
import assert from 'node:assert/strict';
import { createFavouriteStore } from '../src/favourites.js';
const favourite = { label: 'School', stopId: '18492910339410B1', route: '1', direction: 'O', serviceType: '1', stopSequence: 1, walkMinutes: 4, bufferMinutes: 2 };
function memory() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }

test('favourites survive a new store instance; saving same service updates it', () => {
  const storage = memory();
  const store = createFavouriteStore({ storage });
  const saved = store.save(favourite);
  store.save({ ...favourite, walkMinutes: 6 });
  const reloaded = createFavouriteStore({ storage }).load();
  assert.equal(reloaded.status, 'ok');
  assert.equal(reloaded.favourites.length, 1);
  assert.equal(reloaded.favourites[0].walkMinutes, 6);
  store.remove(saved.id);
  assert.equal(store.load().favourites.length, 0);
});
test('opposite directions and repeated stop sequences are separate favourites', () => {
  const store = createFavouriteStore({ storage: memory() });
  store.save(favourite); store.save({ ...favourite, direction: 'I' }); store.save({ ...favourite, stopSequence: 20 });
  assert.equal(store.load().favourites.length, 3);
});
test('corrupt or unavailable storage is visible and never silently overwritten', () => {
  const store = createFavouriteStore({ storage: { getItem: () => '{', setItem: () => assert.fail('must not overwrite') } });
  assert.equal(store.load().status, 'corrupt');
  assert.throws(() => store.save(favourite), { code: 'STORAGE_CORRUPT' });
  assert.equal(createFavouriteStore({ storage: null }).load().status, 'unavailable');
});
test('quota failure and bad input are explicit', () => {
  const store = createFavouriteStore({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } });
  assert.throws(() => store.save(favourite), { code: 'STORAGE_UNAVAILABLE' });
  assert.throws(() => store.save({ ...favourite, walkMinutes: -3 }), { code: 'INVALID_INPUT' });
});
