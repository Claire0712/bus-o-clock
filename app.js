import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { createBusOClock, createKmbClient, createCapacitorLocationProvider } from './packages/data/src/index.js';
import { createI18n, LANGUAGES } from './i18n.js';
import { PLAN_IDS, timePlans, arrivalDay, recommendationReason } from './journey-tools.js';
import { createStopMap } from './stop-map.js';
import { walkingDirectionsUrl } from './navigation.js';

const bus = createBusOClock(Capacitor.isNativePlatform() ? { locationProvider: createCapacitorLocationProvider(Geolocation) }
  : { client: createKmbClient({ catalogueBaseUrl: new URL('data/', document.baseURI).href }) });
const i18n = createI18n(), t = (key, values) => i18n.t(key, values);
const screen = document.querySelector('#screen'), status = document.querySelector('#status');
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page, selected, current, stopWatch = () => {}, controller, generation = 0;
let nearbyResult, routeStop, routeResults, lastAdvice, formDraft, manualDraft = {};
let searchQuery = '', searchResult, routeFilter = null, mapOpen = false, mapInstance, mapView, planDraft;
let notice = () => '', preferenceNotSaved = false;
let focusedStopId = null;
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
function navigationLink(point,style='primary') {
  const link=document.createElement('a');link.className=`btn ${style} walking-link`;
  link.href=walkingDirectionsUrl(point);link.target=Capacitor.isNativePlatform()?'_self':'_blank';link.rel='noopener noreferrer';
  link.textContent=t('walkToStop')+' ↗';return link;
}
function stopDetails(stop) {
  const details=document.createElement('details');details.className='stop-details';
  const summary=document.createElement('summary');summary.textContent=t('stopDetails');
  const info=document.createElement('p');info.textContent=`ID: ${stop.id??stop.stopId}`;details.append(summary,info);return details;
}
async function savedNavigation(host,value) {
  const token=generation;
  host.textContent=t('navigationLoading');
  try {
    const point=value.stopPoint??(await bus.client.getStops({signal:controller.signal})).find(s=>s.id===value.stopId);
    if(token!==generation||!host.isConnected)return;
    const link=navigationLink(point,'secondary'),hint=document.createElement('p');hint.className='sub';hint.textContent=t('navigationHint');
    host.replaceChildren(link,hint);
  } catch(error) {
    if(token!==generation||!host.isConnected||error.code==='ABORTED')return;
    const hint=document.createElement('p');hint.className='sub';hint.textContent=t('navigationUnavailable');
    host.replaceChildren(hint,button(t('refreshStops'),()=>savedNavigation(host,value),'quiet'));
  }
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
  captureDrafts();
  preferenceNotSaved = !i18n.setLanguage(language);
  // Keep in-flight requests, selected services and form values intact. Only render text.
  renderGlobal(); renderPage();
}
function captureDrafts() {
  if (page === 'settings' && el('label')) {
    formDraft = { label:el('label').value, walk:el('walk').value, buffer:el('buffer').value };
    if (planDraft) planDraft.plans[planDraft.active] = {walkMinutes:formDraft.walk,bufferMinutes:formDraft.buffer};
  }
  if (page === 'nearby' && el('latitude')) {
    manualDraft = { latitude:el('latitude').value, longitude:el('longitude').value, open:el('manual-location').open, otherOpen:el('other-options').open };
    searchQuery = el('stop-query').value;
  }
}
function clockText(eta, now) {
  const time = i18n.formatClock(eta);
  return arrivalDay(eta,now) ? t('nextDay',{time}) : time;
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
    p.textContent = [t('arrivalMinutes', {minutes:Math.ceil(d.arrivalInSeconds / 60)}), t('arrivalAt',{time:clockText(d.eta,state.evaluatedAt)}), d.scheduled && t('scheduled'), !d.catchable && t('tooSoon')].filter(Boolean).join(' · ');
    if(d === state.recommended) p.classList.add('recommended-arrival');
    return p;
  }));
  el('remarks').textContent = state.remarks.map(r => i18n.officialText(r)).filter(Boolean).join(' · ');
  const reason = recommendationReason(state,current);
  el('why').hidden = !reason;
  if(reason) el('reason').textContent=t(reason.key,{...reason.values,first:clockText(reason.firstEta,state.evaluatedAt),chosen:clockText(reason.chosenEta,state.evaluatedAt)});
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
  reset(); page = next; message(); formDraft = null; planDraft = null; lastAdvice = null;
  if (next === 'nearby') { nearbyResult = null; searchResult = null; searchQuery = ''; manualDraft = {}; mapView = null; focusedStopId = null; }
  window.scrollTo(0, 0); renderPage();
  if (['home','details'].includes(page)) startAdvice();
}
function renderPage() {
  if(mapInstance) { mapView = mapInstance.view(); mapInstance.destroy(); mapInstance = null; }
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
    screen.insertAdjacentHTML('beforeend', `<p class="saved-stop">${esc(i18n.officialText(current.stopName))} ${esc(current.destination ? '→ '+i18n.officialText(current.destination) : t(current.direction === 'O' ? 'outbound' : 'inbound'))}</p><div id="saved-stop-details"></div><div class="card hero"><span>${esc(t('commuteRoute', {label:current.label, route:current.route}))}</span><div id="advice" class="big"></div></div><div id="quick-plans" class="plan-options" role="group" aria-label="${esc(t('plansTitle'))}"></div><p class="sub">${esc(t('walkBuffer', {walk:current.walkMinutes, buffer:current.bufferMinutes}))}</p><p id="freshness" class="sub"></p><div id="arrivals"></div><section id="why" class="reason-card" hidden><h3>${esc(t('whyTitle'))}</h3><p id="reason"></p></section><p class="sub">${esc(t('adviceEstimate'))}</p><p id="remarks" class="sub"></p><div id="saved-navigation"></div>`);
    el('saved-stop-details').append(stopDetails(current));savedNavigation(el('saved-navigation'),current);
    const plans = timePlans(current);
    for(const id of PLAN_IDS) {
      const choice = button(t(id),()=>{ try {current=bus.favourites.save({...current,...plans[id],timePresets:plans,activePreset:id});show('home');} catch(e){fail(e);} });
      choice.setAttribute('aria-pressed',String((current.activePreset??'regular')===id)); choice.dataset.testid='quick-'+id;el('quick-plans').append(choice);
    }
    screen.append(button(t('refresh'), startAdvice), button(t('edit'), () => show('settings')), button(t('delete'), () => {
      try { bus.favourites.remove(current.id); current = bus.favourites.load().favourites[0]; show('home'); } catch (e) { fail(e); }
    }, 'quiet'));
    renderAdvice(lastAdvice);
  } else if (page === 'nearby') {
    screen.innerHTML = `<h2>${esc(t('chooseStop'))}</h2><p class="page-intro">${esc(t('nearbyIntro'))}</p>
      <form id="stop-search" class="search-form"><label for="stop-query">${esc(t('searchLabel'))}</label><div class="search-row"><input id="stop-query" type="search" maxlength="100" placeholder="${esc(t('searchPlaceholder'))}" value="${esc(searchQuery)}"><button class="btn primary" type="submit">${esc(t('searchGo'))}</button></div><p class="sub">${esc(t('searchHint'))}</p></form>
      <div class="nearby-actions"><div id="locationActions"></div><div id="map-actions"></div></div>
      <details id="other-options" class="other-options"><summary>${esc(t('otherOptions'))}</summary><div id="example"></div><details id="manual-location"><summary>${esc(t('manualLocation'))}</summary><label for="latitude">${esc(t('latitude'))}</label><input id="latitude" type="number" step="any" min="-90" max="90"><label for="longitude">${esc(t('longitude'))}</label><input id="longitude" type="number" step="any" min="-180" max="180"><div id="manual"></div></details><div id="catalogue-actions"></div></details>
      <section id="map-section"></section><section id="selected-stop" class="selected-stop" hidden></section><p id="result-summary" class="sub"></p><div id="results"></div>`;
    el('stop-search').onsubmit=e=>{e.preventDefault();loadSearch(el('stop-query').value);};
    el('latitude').value=manualDraft.latitude??'';el('longitude').value=manualDraft.longitude??'';
    el('manual-location').open=!!manualDraft.open;el('other-options').open=!!manualDraft.otherOpen;
    el('locationActions').append(button(t('useLocation'),()=>loadNearby(),'secondary'));
    el('example').append(button(t('publicExample'),()=>loadNearby({latitude:22.345415,longitude:114.192640})));
    el('manual').append(button(t('findCoordinates'),()=>{
      if(!el('latitude').value||!el('longitude').value){message('enterCoordinates');return;}
      loadNearby({latitude:Number(el('latitude').value),longitude:Number(el('longitude').value)});
    }));
    el('map-actions').append(button(t(mapOpen?'hideMap':'showMap'),()=>{captureDrafts();mapOpen=!mapOpen;renderPage();}));
    el('catalogue-actions').append(button(t('refreshStops'),()=>{bus.client.clearCache();if(searchQuery.trim())loadSearch(searchQuery);else if(nearbyResult)loadNearby(nearbyResult.location);else message('searchHint');},'quiet'));
    renderStops();renderMap();renderSelectedStop();
  } else if (page === 'routes') {
    screen.innerHTML = `<div id="back-stops"></div><h2>${esc(i18n.officialText(routeStop.name))}</h2><div id="route-navigation"></div><div id="route-stop-details"></div><div id="routes"></div>`;
    el('back-stops').append(button(t('backToStops'),()=>{reset();page='nearby';message();renderPage();},'quiet'));
    el('route-navigation').append(navigationLink(routeStop));el('route-stop-details').append(stopDetails(routeStop));renderRoutes();
  } else if (page === 'settings') {
    screen.innerHTML = `<h2>${esc(t('settings'))}</h2><section class="language-settings"><h3>${esc(t('languageTitle'))}</h3></section>`;
    const languageSection = screen.querySelector('.language-settings'); languageSection.append(languageControl('settings-language'));
    for (const key of ['languageHelp','officialNames']) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = t(key); languageSection.append(p); }
    const value = selected || current;
    if (!value) {
      const p = document.createElement('p'); p.textContent = t('selectService'); screen.append(p, button(t('findStop'), () => show('nearby'), 'primary')); return;
    }
    if(!planDraft)planDraft={active:value.activePreset??'regular',plans:timePlans(value)};
    const activeTimes=planDraft.plans[planDraft.active];
    screen.insertAdjacentHTML('beforeend',`<h3>${esc(t('plansTitle'))}</h3><div id="edit-plans" class="plan-options" role="group" aria-label="${esc(t('plansTitle'))}"></div><p class="sub">${esc(t('plansHelp'))}</p>`);
    for(const id of PLAN_IDS){const choice=button(t(id),()=>{captureDrafts();planDraft.active=id;formDraft={...formDraft,walk:planDraft.plans[id].walkMinutes,buffer:planDraft.plans[id].bufferMinutes};renderPage();});choice.setAttribute('aria-pressed',String(planDraft.active===id));choice.dataset.testid='plan-'+id;el('edit-plans').append(choice);}
    screen.insertAdjacentHTML('beforeend', `<h3>${esc(t('makeCommute'))}</h3><p>${esc(t('route', {route:value.route}))} · ${esc(i18n.officialText(value.destination) || t(value.direction === 'O' ? 'outbound' : 'inbound'))}</p><label for="label">${esc(t('commuteName'))}</label><input id="label" maxlength="100" value="${esc(formDraft?.label ?? value.label ?? t('myCommute'))}"><label for="walk">${esc(t('walkMinutes'))}</label><input id="walk" type="number" min="0" max="180" step="any" value="${esc(formDraft?.walk ?? activeTimes.walkMinutes)}"><label for="buffer">${esc(t('bufferMinutes'))}</label><input id="buffer" type="number" min="0" max="180" step="any" value="${esc(formDraft?.buffer ?? activeTimes.bufferMinutes)}">`);
    screen.append(button(t('save'), () => {
      if (!el('walk').value || !el('buffer').value) { message('enterTimes'); return; }
      const walkMinutes = Number(el('walk').value), bufferMinutes = Number(el('buffer').value), label = el('label').value.trim();
      if (![walkMinutes, bufferMinutes].every(n => Number.isFinite(n) && n >= 0 && n <= 180)) { message('validTimes'); return; }
      if (!label || label.length > 100) { message('validName'); return; }
      captureDrafts();
      const plans=Object.fromEntries(PLAN_IDS.map(id=>[id,{walkMinutes:Number(planDraft.plans[id].walkMinutes),bufferMinutes:Number(planDraft.plans[id].bufferMinutes)}]));
      if(PLAN_IDS.some(id=>Object.values(planDraft.plans[id]).some(v=>v==='')) || !Object.values(plans).every(p=>Object.values(p).every(n=>Number.isFinite(n)&&n>=0&&n<=180))){message('validTimes');return;}
      try { current = bus.favourites.save({...value, label, walkMinutes, bufferMinutes,timePresets:plans,activePreset:planDraft.active}); selected = null; show('home'); } catch (e) { fail(e); }
    }, 'primary'));
  }
}
function resultStops(){return searchResult?.stops??nearbyResult?.stops??[];}
function chooseStop(stop,fromMap=false){
  focusedStopId=stop.id;
  document.querySelectorAll('.stop-select').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stopId===stop.id)));
  renderSelectedStop();
  if(!fromMap){mapInstance?.select(stop.id);el('selected-stop').scrollIntoView({block:'nearest'});}
}
function renderSelectedStop(){
  const host=el('selected-stop');if(!host)return;
  const stop=resultStops().find(s=>s.id===focusedStopId);host.hidden=!stop;if(!stop)return;
  host.innerHTML=`<p class="eyebrow">${esc(t('selectedStop'))}</p><h3>${esc(i18n.officialText(stop.name))}</h3><p class="sub">${esc(t('navigationHint'))}</p>`;
  host.append(navigationLink(stop),button(t('busRoutes'),()=>loadRoutes(stop,searchResult?.routeFilter),'secondary'),stopDetails(stop));
}
function renderStops(){
  if(!el('results'))return;
  const stops=resultStops();
  el('result-summary').textContent=searchResult?searchResult.total>stops.length?t('searchMore',{count:stops.length,total:searchResult.total}):t(searchResult.total?'searchCount':'searchEmpty',{count:searchResult.total}):'';
  el('results').replaceChildren(...stops.map((stop,index)=>{
    const choice=button('',()=>chooseStop(stop),'choice stop-select');choice.dataset.stopId=stop.id;
    choice.setAttribute('aria-label',`${index+1}. ${i18n.officialText(stop.name)}`);choice.setAttribute('aria-pressed',String(stop.id===focusedStopId));
    choice.innerHTML=`<span class="stop-number" aria-hidden="true">${index+1}</span><span class="stop-copy"><strong>${esc(i18n.officialText(stop.name))}</strong><span>${esc(Number.isFinite(stop.distanceMeters)?t('distance',{metres:Math.round(stop.distanceMeters)}):t('selectStopHint'))}</span></span>`;
    return choice;
  }));
  if(searchResult&&searchResult.total>stops.length)el('results').append(button(t('moreStops'),()=>loadSearch(searchQuery,Math.min(10000,stops.length+40))));
}
function renderMap(){
  if(!mapOpen)return;
  el('map-section').innerHTML=`<h3>${esc(t('mapTitle'))}</h3><p class="sub">${esc(t('mapSelectionHint'))}</p>${!nearbyResult&&!searchResult?`<p class="sub">${esc(t('mapDefault'))}</p>`:''}<div id="stop-map" role="region" aria-label="${esc(t('mapTitle'))}"></div><div id="area-search"></div>`;
  mapInstance=createStopMap(el('stop-map'),{stops:resultStops(),center:nearbyResult?.location,view:mapView,selectedStopId:focusedStopId,t,name:v=>i18n.officialText(v),onSelect:s=>chooseStop(s,true),onStop:s=>loadRoutes(s,searchResult?.routeFilter),onSearch:p=>loadNearby(p),navigationLink});
  el('area-search').append(button(t('mapSearch'),()=>mapInstance.search()));
}
async function loadSearch(query,limit=40){
  captureDrafts();searchQuery=query.trim();if(!searchQuery){message('searchHint');return;}
  reset();const token=generation;searchResult=null;nearbyResult=null;mapView=null;focusedStopId=null;renderPage();message('searchingStops');
  try{const result=await bus.client.searchStops(searchQuery,{signal:controller.signal,limit});if(token!==generation)return;searchResult=result;mapView=null;if(mapInstance){mapInstance.destroy();mapInstance=null;}message();renderPage();}catch(e){if(token===generation)fail(e);}
}
async function loadNearby(point) {
  captureDrafts();reset(); const token = generation; nearbyResult = null;searchResult=null;searchQuery='';focusedStopId=null;
  if(point)manualDraft={...manualDraft,latitude:point.latitude,longitude:point.longitude};
  renderPage(); message(point ? 'searchingManual' : 'searchingDevice');
  try {
    const result = await bus.getNearbyStops({point, signal:controller.signal}); if (token !== generation) return;
    nearbyResult = result;manualDraft.otherOpen=false;manualDraft.open=false;
    message(() => [t('nearbyFound', {count:result.stops.length, source:t(result.locationSource)}), result.location.accuracyMeters != null && t('accuracy', {metres:Math.round(result.location.accuracyMeters)})].filter(Boolean).join(' · '));
    if(mapInstance){mapInstance.destroy();mapInstance=null;}mapView=null;renderPage();
  } catch (e) { if (token === generation) fail(e); }
}
function renderRoutes(){
  if(!routeResults||!el('routes'))return;
  el('routes').replaceChildren(...routeResults.map(r=>{
    const card=document.createElement('article');card.className='route-result';
    const choice=button('',()=>{selected={...r,stopName:routeStop.name,stopPoint:{latitude:routeStop.latitude,longitude:routeStop.longitude}};show('settings');},'choice');
    choice.setAttribute('aria-label',`${r.route} → ${i18n.officialText(r.destination)} · ${t(r.direction==='O'?'outbound':'inbound')}`);
    choice.innerHTML=`<span class="route-number">${esc(r.route)}</span><span class="stop-copy"><strong>→ ${esc(i18n.officialText(r.destination))}</strong><span>${esc(t(r.direction==='O'?'outbound':'inbound'))}</span></span>`;
    const details=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p');
    details.className='service-details';summary.textContent=t('serviceDetails');info.textContent=t('serviceOption',{route:r.route,destination:i18n.officialText(r.destination),direction:t(r.direction==='O'?'outbound':'inbound'),service:r.serviceType,stop:r.stopSequence});
    details.append(summary,info);card.append(choice,details);return card;
  }));
}
async function loadRoutes(stop,filter = null) {
  reset(); const token = generation; page = 'routes'; routeStop = stop; routeResults = null;routeFilter=filter;
  renderPage(); message('loadingRoutes');
  try { const routes = await bus.getRoutesForStop(stop.id, {signal:controller.signal}); if (token !== generation) return;
    routeResults = routeFilter?routes.filter(r=>r.route===routeFilter):routes; message(routeResults.length ? 'chooseRoute' : 'noRoutes'); renderRoutes();
  } catch (e) { if (token === generation) fail(e); }
}
document.querySelector('header').append(languageControl('language-select'));
const languageStatus = document.createElement('p'); languageStatus.id = 'language-status'; languageStatus.setAttribute('role', 'status'); document.querySelector('header').append(languageStatus);
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { selected = null; show(b.dataset.page); });
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); else startAdvice(); });
window.addEventListener('pagehide', reset);
renderGlobal(); show('home');
