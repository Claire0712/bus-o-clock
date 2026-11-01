import { createBusOClock } from '../src/index.js';
const service = createBusOClock();
const element = id => document.getElementById(id);
let routes = [];
let cleanup = () => {};
let revision = 0;
const loaded = service.favourites.load();
element('saved').textContent = `Saved commutes: ${loaded.favourites.length} (storage: ${loaded.status})`;

function option(value, text) { const node = document.createElement('option'); node.value = value; node.textContent = text; return node; }
function fail(error) { element('status').textContent = `${error.code ?? 'ERROR'}: ${error.message}`; }
function start() {
  cleanup();
  const route = routes[Number(element('routes').value)];
  if (!route) return;
  try {
    const selection = { ...route, walkMinutes: Number(element('walk').value), bufferMinutes: Number(element('buffer').value) };
    cleanup = service.watchCommute(selection, state => {
      const messages = { loading: 'Loading arrival estimates…', error: 'Could not load live arrivals', stale: 'Arrival data is out of date', 'no-service': 'No arrival estimate available', 'too-late': 'Shown buses are too soon for your walking time' };
      element('advice').textContent = state.recommended
        ? `${state.status === 'leave-now' ? 'Leave soon' : 'Leave in'} · ${Math.floor(state.leaveInSeconds / 60)}m ${state.leaveInSeconds % 60}s`
        : messages[state.status];
      element('output').textContent = JSON.stringify(state, null, 2);
    });
  } catch (error) { element('advice').textContent = 'Check your settings'; fail(error); }
}
async function selectStop() {
  const token = ++revision;
  cleanup(); routes = [];
  element('save').disabled = true; element('routes').disabled = true;
  element('advice').textContent = 'Select a route'; element('output').textContent = 'Loading routes…';
  element('status').textContent = 'Loading stop routes…';
  try {
    const result = await service.getRoutesForStop(element('stops').value);
    if (token !== revision) return;
    routes = result;
    element('routes').replaceChildren(...routes.map((r, i) => option(String(i), `${r.route} → ${r.destination.en} (${r.direction}, service ${r.serviceType}, stop ${r.stopSequence})`)));
    element('routes').disabled = !routes.length; element('save').disabled = !routes.length;
    element('status').textContent = `${routes.length} route/sequence options loaded.`;
    start();
  } catch (error) { if (token === revision) fail(error); }
}
async function load(point) {
  const token = ++revision;
  cleanup(); routes = [];
  element('stops').disabled = true; element('routes').disabled = true; element('save').disabled = true;
  element('advice').textContent = 'Loading nearby stops…'; element('output').textContent = 'Waiting for live data…';
  element('status').textContent = point ? 'Loading example location…' : 'Requesting device location…';
  try {
    const result = await service.getNearbyStops({ point, radiusMeters: 1000, limit: 10 });
    if (token !== revision) return;
    element('stops').replaceChildren(...result.stops.map(s => option(s.id, `${s.name.en} · ${Math.round(s.distanceMeters)} m straight-line`)));
    element('stops').disabled = !result.stops.length;
    if (result.stops.length) await selectStop();
    else element('status').textContent = 'No KMB stops within 1 km. Try the example location.';
  } catch (error) { if (token === revision) fail(error); }
}
element('example').addEventListener('click', () => load({ latitude: 22.345415, longitude: 114.192640 }));
element('locate').addEventListener('click', () => load());
element('stops').addEventListener('change', selectStop);
element('routes').addEventListener('change', start);
element('walk').addEventListener('change', start);
element('buffer').addEventListener('change', start);
element('save').addEventListener('click', () => {
  try {
    service.favourites.save({ ...routes[Number(element('routes').value)], label: 'My commute', walkMinutes: Number(element('walk').value), bufferMinutes: Number(element('buffer').value) });
    element('saved').textContent = `Saved commutes: ${service.favourites.load().favourites.length}. Reload to verify persistence.`;
  } catch (error) { fail(error); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) cleanup(); else start(); });
window.addEventListener('pagehide', () => cleanup());
