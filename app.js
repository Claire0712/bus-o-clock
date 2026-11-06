import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { createBusOClock, createCapacitorLocationProvider } from './packages/data/src/index.js';
const bus = createBusOClock(Capacitor.isNativePlatform() ? { locationProvider: createCapacitorLocationProvider(Geolocation) } : {});
const screen = document.querySelector('#screen'), status = document.querySelector('#status');
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page, selected, current, stopWatch = () => {}, controller, generation = 0;
const saved = bus.favourites.load(); current = saved.favourites[0];
const message = text => { status.textContent = text; };
const fail = e => { if (e.code !== 'ABORTED') message(`${e.code ?? 'ERROR'}: ${e.message}`); };
function reset() { generation++; controller?.abort(); controller = new AbortController(); stopWatch(); stopWatch = () => {}; }
function button(text, action) { const b = document.createElement('button'); b.className = 'btn choice'; b.textContent = text; b.onclick = action; return b; }
function startAdvice() {
  stopWatch();
  if (!current || document.hidden || !['home','details'].includes(page)) return;
  stopWatch = bus.watchCommute(current, state => {
    const target = el('advice'); if (!target) return;
    const labels = { loading:'Loading arrivals…', error:'Cannot load arrivals. Retry when connected.', stale:'Arrival data is out of date.', 'no-service':'No arrival estimate available.', 'too-late':'Shown buses are too soon for your walking time.' };
    target.textContent = state.recommended ? `${state.status === 'leave-now' ? 'Leave soon' : 'Leave in'} ${Math.floor(state.leaveInSeconds/60)}m ${state.leaveInSeconds%60}s` : labels[state.status];
    el('freshness').textContent = state.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleTimeString('en-GB',{timeZone:'Asia/Hong_Kong'})} Hong Kong time` : 'No verified update time';
    el('arrivals').replaceChildren(...state.departures.map(d => { const p = document.createElement('p'); p.textContent = `${Math.floor(d.arrivalInSeconds/60)} min${d.scheduled ? ' · Scheduled bus' : ''}${d.catchable ? '' : ' · Too soon for planned walk'}`; return p; }));
    el('remarks').textContent = state.remarks.map(r => r.en || r.tc).join(' · ');
  });
}
function show(next) {
  reset(); page = next; message(''); window.scrollTo(0, 0);
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active',b.dataset.page === page));
  if (page === 'home' || page === 'details') {
    const loaded = bus.favourites.load();
    if (loaded.status !== 'ok') message(`Saved commutes: ${loaded.status}. Existing data will not be overwritten.`);
    screen.innerHTML = '<h2>Your commute</h2><div id="saved"></div>';
    for (const f of loaded.favourites) el('saved').append(button(`${f.label} · ${f.route}`, () => { current=f; show('home'); }));
    if (!current) { screen.append(button('Find a stop',()=>show('nearby'))); return; }
    screen.insertAdjacentHTML('beforeend',`<div class="card hero"><span>${esc(current.label)} · Route ${esc(current.route)}</span><div id="advice" class="big"></div></div><p class="sub">Walking ${current.walkMinutes} min + buffer ${current.bufferMinutes} min</p><p id="freshness" class="sub"></p><div id="arrivals"></div><p id="remarks" class="sub"></p>`);
    screen.append(button('Refresh arrivals',startAdvice),button('Edit commute',()=>show('settings')),button('Delete commute',()=>{try{bus.favourites.remove(current.id);current=bus.favourites.load().favourites[0];show('home');}catch(e){fail(e);}})); startAdvice();
  } else if (page === 'nearby') {
    screen.innerHTML = '<h2>Choose your stop</h2><div id="locationActions"></div><details><summary>Choose location manually</summary><label for="latitude">Latitude</label><input id="latitude" type="number" step="any" min="-90" max="90"><label for="longitude">Longitude</label><input id="longitude" type="number" step="any" min="-180" max="180"><div id="manual"></div></details><div id="results"></div>';
    el('locationActions').append(button('Use my location',()=>loadNearby()),button('Try public example: Chuk Yuen Estate',()=>loadNearby({latitude:22.345415,longitude:114.192640})));
    el('manual').append(button('Find stops at these coordinates',()=>{if(!el('latitude').value || !el('longitude').value){message('Enter both coordinates.');return;}loadNearby({latitude:Number(el('latitude').value),longitude:Number(el('longitude').value)});}));
  } else if (page === 'settings') {
    const value = selected || current;
    if(!value){screen.innerHTML='<h2>Select a service first</h2>';screen.append(button('Find a stop',()=>show('nearby')));return;}
    screen.innerHTML=`<h2>Make it your commute</h2><p>Route ${esc(value.route)} · ${esc(value.destination?.en || value.direction)}</p><label for="label">Commute name</label><input id="label" maxlength="100" value="${esc(value.label || 'My commute')}"><label for="walk">Walking minutes</label><input id="walk" type="number" min="0" max="180" step="any" value="${value.walkMinutes ?? 4}"><label for="buffer">Buffer minutes</label><input id="buffer" type="number" min="0" max="180" step="any" value="${value.bufferMinutes ?? 2}">`;
    screen.append(button('Save commute',()=>{try{if(!el('walk').value||!el('buffer').value)throw new Error('Enter walking and buffer times.');current=bus.favourites.save({...value,label:el('label').value,walkMinutes:Number(el('walk').value),bufferMinutes:Number(el('buffer').value)});selected=null;show('home');}catch(e){fail(e);}}));
  }
}
async function loadNearby(point) {
  reset(); const token=generation; message(point?'Searching from the selected coordinates (not device location)…':'Requesting device location…');el('results').replaceChildren();
  try { const result=await bus.getNearbyStops({point,signal:controller.signal});if(token!==generation)return;
    message(`${result.stops.length} stops within 1 km · ${result.locationSource}${result.location.accuracyMeters!=null ? ` · accuracy ±${Math.round(result.location.accuracyMeters)} m` : ''}`);
    el('results').replaceChildren(...result.stops.map(s=>button(`${s.name.en} · ${Math.round(s.distanceMeters)} m straight-line`,()=>loadRoutes(s))));
  } catch(e){if(token===generation)fail(e);}
}
async function loadRoutes(stop) {
  reset(); const token=generation;page='routes';screen.innerHTML=`<h2>${esc(stop.name.en)}</h2><div id="routes"></div>`;message('Loading services…');
  try { const routes=await bus.getRoutesForStop(stop.id,{signal:controller.signal});if(token!==generation)return;message(routes.length?'Select route and direction':'No boarding services at this stop.');el('routes').replaceChildren(...routes.map(r=>button(`${r.route} → ${r.destination.en} · ${r.direction} / ${r.serviceType} / stop ${r.stopSequence}`,()=>{selected=r;show('settings');}))); }catch(e){if(token===generation)fail(e);}
}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{selected=null;show(b.dataset.page);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else startAdvice();});
window.addEventListener('pagehide',reset);
show('home');
