import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { createBusOClock, createKmbClient, createCapacitorLocationProvider } from './packages/data/src/index.js';
import { createI18n, LANGUAGES } from './i18n.js';

const bus = createBusOClock(Capacitor.isNativePlatform() ? { locationProvider: createCapacitorLocationProvider(Geolocation) }
  : { client: createKmbClient({ catalogueBaseUrl: new URL('data/', document.baseURI).href }) });
const i18n = createI18n(), t = (key, values) => i18n.t(key, values);
const screen = document.querySelector('#screen'), status = document.querySelector('#status');
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page, selected, current, stopWatch = () => {}, controller, generation = 0;
let nearbyResult, routeStop, routeResults, lastAdvice, formDraft, manualDraft = {};
let notice = () => '', preferenceNotSaved = false;
current = bus.favourites.load().favourites[0];

function message(key = '', values) {
  notice = typeof key === 'function' ? key : () => key ? t(key, values) : '';
  status.textContent = notice();
}
function fail(error) {
  if (error.code === 'ABORTED') return;
  const keys = { LOCATION_DENIED:'locationDenied', LOCATION_UNAVAILABLE:'locationUnavailable', LOCATION_TIMEOUT:'locationTimeout',
    NETWORK_ERROR:'networkError', TIMEOUT:'requestTimeout', HTTP_ERROR:'networkError', INVALID_RESPONSE:'invalidResponse',
    INVALID_INPUT:'invalidInput', STORAGE_CORRUPT:'storageError', STORAGE_UNAVAILABLE:'storageError' };
  message(error.uiKey || keys[error.code] || 'unknownError');
}
function reset() { generation++; controller?.abort(); controller = new AbortController(); stopWatch(); stopWatch = () => {}; }
function button(text, action, style = 'secondary') {
  const b = document.createElement('button'); b.className = `btn ${style}`; b.textContent = text; b.onclick = action; return b;
}
function languageControl(id) {
  const root = document.createElement('div'); root.className = 'language-control';
  const label = document.createElement('label'); label.htmlFor = id; label.textContent = t('language');
  const select = document.createElement('select'); select.id = id; select.dataset.languagePicker = ''; select.dataset.testid = id;
  for (const [code, name] of LANGUAGES) {
    const option = document.createElement('option'); option.value = code; option.lang = code; option.textContent = name; select.append(option);
  }
  select.value = i18n.language; select.onchange = () => changeLanguage(select.value);
  root.append(label, select); return root;
}
function renderGlobal() {
  document.documentElement.lang = i18n.language;
  document.querySelector('header .brand p').textContent = t('tagline');
  document.querySelector('.app-footer').textContent = t('footer');
  document.querySelector('nav').setAttribute('aria-label', t('navLabel'));
  document.querySelectorAll('[data-page]').forEach(b => {
    b.setAttribute('aria-label', t(b.dataset.page)); b.querySelector('span').textContent = t(b.dataset.page);
  });
  document.querySelectorAll('[data-language-picker]').forEach(select => {
    select.value = i18n.language; document.querySelector(`label[for="${select.id}"]`).textContent = t('language');
  });
  el('language-status').textContent = preferenceNotSaved ? t('languageSession') : '';
  status.textContent = notice();
}
function changeLanguage(language) {
  if (page === 'settings' && el('label')) formDraft = { label:el('label').value, walk:el('walk').value, buffer:el('buffer').value };
  if (page === 'nearby') manualDraft = { latitude:el('latitude').value, longitude:el('longitude').value, open:el('manual-location').open };
  preferenceNotSaved = !i18n.setLanguage(language);
  // Keep in-flight requests, selected services and form values intact. Only render text.
  renderGlobal(); renderPage();
}
function renderAdvice(state) {
  const target = el('advice'); if (!target || !state) return;
  const keys = { loading:'loadingArrivals', error:'arrivalsError', stale:'stale', 'no-service':'noService', 'too-late':'tooLate' };
  target.textContent = state.recommended ? t(state.status === 'leave-now' ? 'leaveSoon' : 'leaveIn', {
    minutes:Math.floor(state.leaveInSeconds / 60), seconds:state.leaveInSeconds % 60
  }) : t(keys[state.status] || 'arrivalsError');
  el('freshness').textContent = state.updatedAt ? t('updated', { time:i18n.formatTime(state.updatedAt) }) : t('noUpdate');
  el('arrivals').replaceChildren(...state.departures.map(d => {
    const p = document.createElement('p');
    p.textContent = [t('arrivalMinutes', {minutes:Math.floor(d.arrivalInSeconds / 60)}), d.scheduled && t('scheduled'), !d.catchable && t('tooSoon')].filter(Boolean).join(' · ');
    return p;
  }));
  el('remarks').textContent = state.remarks.map(r => i18n.officialText(r)).filter(Boolean).join(' · ');
}
function startAdvice() {
  stopWatch();
  if (!current || document.hidden || !['home','details'].includes(page)) return;
  stopWatch = bus.watchCommute(current, state => { lastAdvice = state; renderAdvice(state); });
}
function updateNavigation() {
  const activePage = page === 'details' ? 'home' : page === 'routes' ? 'nearby' : page;
  document.querySelectorAll('[data-page]').forEach(b => {
    const active = b.dataset.page === activePage; b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function show(next) {
  reset(); page = next; message(); formDraft = null; lastAdvice = null;
  if (next === 'nearby') { nearbyResult = null; manualDraft = {}; }
  window.scrollTo(0, 0); renderPage();
  if (['home','details'].includes(page)) startAdvice();
}
function renderPage() {
  updateNavigation();
  if (page === 'home' || page === 'details') {
    const loaded = bus.favourites.load();
    if (loaded.status !== 'ok') message('storageError');
    screen.innerHTML = `<h2>${esc(t('yourCommute'))}</h2><div id="saved"></div>`;
    for (const f of loaded.favourites) el('saved').append(button(`${f.label} · ${f.route}`, () => { current = f; show('home'); }, 'choice'));
    if (!current) {
      const empty = document.createElement('section'); empty.className = 'empty-state';
      empty.innerHTML = `<span class="empty-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><h3>${esc(t('emptyTitle'))}</h3><p>${esc(t('emptyText'))}</p>`;
      empty.append(button(t('findStop'), () => show('nearby'), 'primary')); screen.append(empty); return;
    }
    screen.insertAdjacentHTML('beforeend', `<div class="card hero"><span>${esc(t('commuteRoute', {label:current.label, route:current.route}))}</span><div id="advice" class="big"></div></div><p class="sub">${esc(t('walkBuffer', {walk:current.walkMinutes, buffer:current.bufferMinutes}))}</p><p id="freshness" class="sub"></p><div id="arrivals"></div><p id="remarks" class="sub"></p>`);
    screen.append(button(t('refresh'), startAdvice), button(t('edit'), () => show('settings')), button(t('delete'), () => {
      try { bus.favourites.remove(current.id); current = bus.favourites.load().favourites[0]; show('home'); } catch (e) { fail(e); }
    }, 'quiet'));
    renderAdvice(lastAdvice);
  } else if (page === 'nearby') {
    screen.innerHTML = `<h2>${esc(t('chooseStop'))}</h2><p class="page-intro">${esc(t('nearbyIntro'))}</p><div id="locationActions"></div><details id="manual-location"><summary>${esc(t('manualLocation'))}</summary><label for="latitude">${esc(t('latitude'))}</label><input id="latitude" type="number" step="any" min="-90" max="90"><label for="longitude">${esc(t('longitude'))}</label><input id="longitude" type="number" step="any" min="-180" max="180"><div id="manual"></div></details><div id="results"></div>`;
    el('latitude').value = manualDraft.latitude ?? ''; el('longitude').value = manualDraft.longitude ?? ''; el('manual-location').open = !!manualDraft.open;
    el('locationActions').append(button(t('useLocation'), () => loadNearby(), 'primary'), button(t('publicExample'), () => loadNearby({latitude:22.345415, longitude:114.192640})));
    el('manual').append(button(t('findCoordinates'), () => {
      if (!el('latitude').value || !el('longitude').value) { message('enterCoordinates'); return; }
      loadNearby({latitude:Number(el('latitude').value), longitude:Number(el('longitude').value)});
    }));
    renderStops();
  } else if (page === 'routes') {
    screen.innerHTML = `<h2>${esc(i18n.officialText(routeStop.name))}</h2><div id="routes"></div>`; renderRoutes();
  } else if (page === 'settings') {
    screen.innerHTML = `<h2>${esc(t('settings'))}</h2><section class="language-settings"><h3>${esc(t('languageTitle'))}</h3></section>`;
    const languageSection = screen.querySelector('.language-settings'); languageSection.append(languageControl('settings-language'));
    for (const key of ['languageHelp','officialNames']) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = t(key); languageSection.append(p); }
    const value = selected || current;
    if (!value) {
      const p = document.createElement('p'); p.textContent = t('selectService'); screen.append(p, button(t('findStop'), () => show('nearby'), 'primary')); return;
    }
    screen.insertAdjacentHTML('beforeend', `<h3>${esc(t('makeCommute'))}</h3><p>${esc(t('route', {route:value.route}))} · ${esc(i18n.officialText(value.destination) || t(value.direction === 'O' ? 'outbound' : 'inbound'))}</p><label for="label">${esc(t('commuteName'))}</label><input id="label" maxlength="100" value="${esc(formDraft?.label ?? value.label ?? t('myCommute'))}"><label for="walk">${esc(t('walkMinutes'))}</label><input id="walk" type="number" min="0" max="180" step="any" value="${esc(formDraft?.walk ?? value.walkMinutes ?? 4)}"><label for="buffer">${esc(t('bufferMinutes'))}</label><input id="buffer" type="number" min="0" max="180" step="any" value="${esc(formDraft?.buffer ?? value.bufferMinutes ?? 2)}">`);
    screen.append(button(t('save'), () => {
      if (!el('walk').value || !el('buffer').value) { message('enterTimes'); return; }
      const walkMinutes = Number(el('walk').value), bufferMinutes = Number(el('buffer').value), label = el('label').value.trim();
      if (![walkMinutes, bufferMinutes].every(n => Number.isFinite(n) && n >= 0 && n <= 180)) { message('validTimes'); return; }
      if (!label || label.length > 100) { message('validName'); return; }
      try { current = bus.favourites.save({...value, label, walkMinutes, bufferMinutes}); selected = null; show('home'); } catch (e) { fail(e); }
    }, 'primary'));
  }
}
function renderStops() {
  if (!nearbyResult || !el('results')) return;
  el('results').replaceChildren(...nearbyResult.stops.map(s => button(`${i18n.officialText(s.name)} · ${t('distance', {metres:Math.round(s.distanceMeters)})}`, () => loadRoutes(s), 'choice')));
}
async function loadNearby(point) {
  reset(); const token = generation; nearbyResult = null;
  message(point ? 'searchingManual' : 'searchingDevice'); el('results').replaceChildren();
  try {
    const result = await bus.getNearbyStops({point, signal:controller.signal}); if (token !== generation) return;
    nearbyResult = result;
    message(() => [t('nearbyFound', {count:result.stops.length, source:t(result.locationSource)}), result.location.accuracyMeters != null && t('accuracy', {metres:Math.round(result.location.accuracyMeters)})].filter(Boolean).join(' · '));
    renderStops();
  } catch (e) { if (token === generation) fail(e); }
}
function renderRoutes() {
  if (!routeResults || !el('routes')) return;
  el('routes').replaceChildren(...routeResults.map(r => button(t('serviceOption', {route:r.route, destination:i18n.officialText(r.destination), direction:t(r.direction === 'O' ? 'outbound' : 'inbound'), service:r.serviceType, stop:r.stopSequence}), () => { selected = r; show('settings'); }, 'choice')));
}
async function loadRoutes(stop) {
  reset(); const token = generation; page = 'routes'; routeStop = stop; routeResults = null;
  renderPage(); message('loadingRoutes');
  try { const routes = await bus.getRoutesForStop(stop.id, {signal:controller.signal}); if (token !== generation) return;
    routeResults = routes; message(routes.length ? 'chooseRoute' : 'noRoutes'); renderRoutes();
  } catch (e) { if (token === generation) fail(e); }
}
document.querySelector('header').append(languageControl('language-select'));
const languageStatus = document.createElement('p'); languageStatus.id = 'language-status'; languageStatus.setAttribute('role', 'status'); document.querySelector('header').append(languageStatus);
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { selected = null; show(b.dataset.page); });
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); else startAdvice(); });
window.addEventListener('pagehide', reset);
renderGlobal(); show('home');
