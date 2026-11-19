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

test('exact stop, direction, metadata and both time plans survive reloading',()=>{
 const storage=memory(),store=createFavouriteStore({storage});
 const value={...favourite,stopName:{en:'Stop',tc:'站',sc:'站'},destination:{en:'Campus',tc:'校園',sc:'校园'},activePreset:'regular',timePresets:{regular:{walkMinutes:4,bufferMinutes:2},extra:{walkMinutes:8,bufferMinutes:3}}};
 store.save(value);const saved=createFavouriteStore({storage}).load().favourites[0];
 assert.deepEqual(saved.timePresets,value.timePresets);assert.deepEqual(saved.stopName,value.stopName);assert.equal(saved.stopId,favourite.stopId);
 store.save({...saved,...saved.timePresets.extra,activePreset:'extra'});
 assert.equal(store.load().favourites[0].walkMinutes,8);
 assert.equal(store.load().favourites[0].timePresets.regular.walkMinutes,4);
});
test('invalid inactive plans and mismatched active times cannot corrupt saved favourites',()=>{
 const store=createFavouriteStore({storage:memory()});store.save(favourite);
 for(const extra of [{walkMinutes:-1,bufferMinutes:3},{walkMinutes:Infinity,bufferMinutes:3}])assert.throws(()=>store.save({...favourite,activePreset:'regular',timePresets:{regular:{walkMinutes:4,bufferMinutes:2},extra}}),{code:'INVALID_INPUT'});
 assert.throws(()=>store.save({...favourite,activePreset:'extra',timePresets:{regular:{walkMinutes:4,bufferMinutes:2},extra:{walkMinutes:8,bufferMinutes:3}}}),{code:'INVALID_INPUT'});
 assert.equal(store.load().favourites[0].walkMinutes,4);
});
