import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { createBusOClock, createKmbClient, createCapacitorLocationProvider, getCurrentLocation } from './packages/data/src/index.js';
import { createI18n, LANGUAGES } from './i18n.js';
import { PLAN_IDS, timePlans, arrivalDay, recommendationReason } from './journey-tools.js';
import { createStopMap } from './stop-map.js';
import { createWalkingClient } from './navigation.js';
import { createWalkingJourney } from './walking-view.js';
const requestWalkingRoute=createWalkingClient();
const acquireWalkingLocation=Capacitor.isNativePlatform()?createCapacitorLocationProvider(Geolocation):getCurrentLocation;
let walkingJourney;

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
let setupFromSearch = false;
let editingCommute = false, searchService = null, plansOpen = false, settingsReturn = null;
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
function reset() { walkingJourney?.cancel(); generation++; controller?.abort(); controller = new AbortController(); stopWatch(); stopWatch = () => {}; }
function button(text, action, style = 'secondary') {
  const b = document.createElement('button'); b.className = `btn ${style}`; b.textContent = text; b.onclick = action; return b;
}
function navigationLink(point,style='primary') {
  const action=button(t('walkToStop'),()=>openWalking(point),style+' walking-link');
  return action;
}
function openWalking(stop) {
  const previousPage=page;reset();walkingJourney?.dispose();
  walkingJourney=createWalkingJourney({stop,getLocation:acquireWalkingLocation,requestRoute:requestWalkingRoute});
  walkingJourney.back=()=>{reset();walkingJourney.dispose();walkingJourney=null;page=previousPage;message();renderPage();startAdvice();};
  page='walking';message();window.scrollTo(0,0);renderPage();
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
    if(!point)throw new Error('Missing stop coordinates');
    const link=navigationLink({...point,id:value.stopId,name:value.stopName??point.name},'secondary'),hint=document.createElement('p');hint.className='sub';hint.textContent=t('navigationHint');
    host.replaceChildren(link,hint);
  } catch(error) {
    if(token!==generation||!host.isConnected||error.code==='ABORTED')return;
    const hint=document.createElement('p');hint.className='sub';hint.textContent=t('navigationUnavailable');
    host.replaceChildren(hint,button(t('refreshStops'),()=>savedNavigation(host,value),'quiet'));
  }
}
function languageControl(id) {
  const root = document.createElement('div'); root.className = 'language-control';
  const label = document.createElement('label'); label.htmlFor = id; label.textContent = i18n.language==='en'?'Language':`${t('language')} / Language`;
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
    select.value = i18n.language; document.querySelector(`label[for="${select.id}"]`).textContent = i18n.language==='en'?'Language':`${t('language')} / Language`;
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
  if (page === 'setup' && el('label')) {
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
  const activePage = page === 'walking' ? 'nearby' : page === 'details' ? 'home' : page === 'routes' ? 'nearby' : page === 'setup' ? (editingCommute ? 'home' : 'nearby') : page;
  document.querySelectorAll('[data-page]').forEach(b => {
    const active = b.dataset.page === activePage; b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function show(next) {
  if (next === 'settings') {
    if (page !== 'settings') { captureDrafts(); settingsReturn = page; stopWatch(); }
    page = 'settings'; renderPage(); return;
  }
  settingsReturn = null;
  reset();walkingJourney?.dispose();walkingJourney=null; page = next; message(); formDraft = null; planDraft = null; lastAdvice = null;
  if (next === 'nearby') { searchService = null; nearbyResult = null; searchResult = null; searchQuery = ''; manualDraft = {}; mapView = null; focusedStopId = null; }
  window.scrollTo(0, 0); renderPage();
  if (['home','details'].includes(page)) startAdvice();
}
function setupProgress(step) {
  return `<ol class="setup-progress" aria-label="${esc(t('flowLabel'))}">${['stepStops','stepService','stepTimes'].map((key,index)=>`<li class="${index+1===step?'current':index+1<step?'complete':''}" ${index+1===step?'aria-current="step"':''}><span aria-hidden="true">${index+1<step?'✓':index+1}</span>${esc(t(key))}</li>`).join('')}</ol>`;
}
function welcomeSteps() {
  return `<ol class="welcome-steps">${[['stepStops','welcomeStop'],['stepService','welcomeRoute'],['stepTimes','welcomeTime']].map(([title,copy],i)=>`<li><span aria-hidden="true">${i+1}</span><div><strong>${esc(t(title))}</strong><p>${esc(t(copy))}</p></div></li>`).join('')}</ol>`;
}
function resumeStops() { reset(); page='nearby'; message(); window.scrollTo(0,0); renderPage(); }
function openSetup(value,edit=false,fromSearch=false) { setupFromSearch=fromSearch; plansOpen=edit || value.activePreset==='extra'; selected=value; editingCommute=edit; show('setup'); }
function renderPage() {
  walkingJourney?.unmount();
  document.querySelector('.app-footer').textContent=t(page==='walking'?'walkFooter':'footer');
  if(mapInstance) { mapView = mapInstance.view(); mapInstance.destroy(); mapInstance = null; }
  updateNavigation();
  document.querySelector('header .language-control').hidden = !(page === 'home' && !current);
  if(page==='walking'){walkingJourney.render(screen,{t,name:v=>i18n.officialText(v)||t('selectedStop'),back:walkingJourney.back});return;}
  if (page === 'home' || page === 'details') {
    const loaded = bus.favourites.load();
    if (loaded.status !== 'ok') message('storageError');
    if (!current) {
      screen.innerHTML = `<section class="welcome" aria-labelledby="welcome-title"><div class="welcome-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h2 id="welcome-title">${esc(t('welcomeTitle'))}</h2><p class="welcome-intro">${esc(t('welcomeIntro'))}</p><div id="welcome-action"></div><p class="welcome-note">${esc(t('welcomeNote'))}</p>${welcomeSteps()}</section>`;
      el('welcome-action').append(button(t('startSetup'),()=>show('nearby'),'primary')); return;
    }
    screen.innerHTML = `<div class="section-heading"><div><h2>${esc(t('yourCommute'))}</h2><p class="page-intro">${esc(t('homeIntro'))}</p></div><div id="add-commute"></div></div><div id="saved" role="group" aria-label="${esc(t('yourCommute'))}"></div>`;
    el('add-commute').append(button(t('addCommute'),()=>{selected=null;show('nearby');},'secondary'));
    for (const f of loaded.favourites) { const choice=button(`${f.label} · ${f.route}`, () => { current = f; show('home'); }, 'choice'); choice.setAttribute('aria-pressed',String(f.id===current.id));el('saved').append(choice); }
    screen.insertAdjacentHTML('beforeend', `<p class="saved-stop">${esc(i18n.officialText(current.stopName))} ${esc(current.destination ? '→ '+i18n.officialText(current.destination) : t(current.direction === 'O' ? 'outbound' : 'inbound'))}</p><div id="saved-stop-details"></div><div class="card hero"><span>${esc(t('commuteRoute', {label:current.label, route:current.route}))}</span><div id="advice" class="big"></div></div><div id="quick-plans" class="plan-options" role="group" aria-label="${esc(t('plansTitle'))}"></div><p class="sub">${esc(t('walkBuffer', {walk:current.walkMinutes, buffer:current.bufferMinutes}))}</p><p id="freshness" class="sub"></p><div id="arrivals"></div><section id="why" class="reason-card" hidden><h3>${esc(t('whyTitle'))}</h3><p id="reason"></p></section><p class="sub">${esc(t('adviceEstimate'))}</p><p id="remarks" class="sub"></p><div id="saved-navigation"></div>`);
    el('saved-stop-details').append(stopDetails(current));savedNavigation(el('saved-navigation'),current);
    const plans = timePlans(current);
    for(const id of PLAN_IDS) {
      const choice = button(t(id),()=>{ try {current=bus.favourites.save({...current,...plans[id],timePresets:plans,activePreset:id});show('home');} catch(e){fail(e);} });
      choice.setAttribute('aria-pressed',String((current.activePreset??'regular')===id)); choice.dataset.testid='quick-'+id;el('quick-plans').append(choice);
    }
    screen.append(button(t('refresh'), startAdvice), button(t('edit'), () => openSetup(current,true)), button(t('delete'), () => {
      try { bus.favourites.remove(current.id); current = bus.favourites.load().favourites[0]; show('home'); } catch (e) { fail(e); }
    }, 'quiet'));
    renderAdvice(lastAdvice);
  } else if (page === 'nearby') {
    screen.innerHTML = `${setupProgress(1)}<h2>${esc(t('chooseStop'))}</h2><p class="page-intro">${esc(t('nearbyIntro'))}</p>
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
    screen.innerHTML = `${setupProgress(2)}<div id="back-stops"></div><h2>${esc(t('chooseRoute'))}</h2><p class="selection-summary">${esc(i18n.officialText(routeStop.name))}</p><div id="routes"></div><div id="route-stop-details"></div><div id="route-navigation"></div>`;
    el('back-stops').append(button(t('backToStops'),resumeStops,'quiet'));
    el('route-navigation').append(navigationLink(routeStop,'secondary'));el('route-stop-details').append(stopDetails(routeStop));renderRoutes();
  } else if (page === 'settings') {
    screen.innerHTML = `<h2>${esc(t('settings'))}</h2><p class="page-intro">${esc(t('settingsIntro'))}</p><section class="settings-card language-settings"><h3>${esc(t('languageTitle'))}</h3></section><section class="settings-card"><h3>${esc(t('settingsDataTitle'))}</h3><p class="sub">${esc(t('settingsDataText'))}</p></section><details class="settings-help"><summary>${esc(t('settingsHelp'))}</summary>${welcomeSteps()}<p class="sub">${esc(t('settingsCommuteHint'))}</p></details>`;
    if(settingsReturn) screen.prepend(button(t('returnPrevious'),()=>{page=settingsReturn;settingsReturn=null;renderPage();startAdvice();},'quiet return-previous'));
    const languageSection = screen.querySelector('.language-settings'); languageSection.append(languageControl('settings-language'));
    for (const key of ['languageHelp','officialNames']) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = t(key); languageSection.append(p); }
  } else if (page === 'setup') {
    const value = selected;
    if (!value) { show('home'); return; }
    screen.innerHTML = `${editingCommute?'':setupProgress(3)}<div id="back-setup"></div><h2>${esc(t(editingCommute?'edit':'timingTitle'))}</h2><p class="page-intro">${esc(t('timingHelp'))}</p><section class="selection-summary"><strong>${esc(t('route',{route:value.route}))} → ${esc(i18n.officialText(value.destination)||t(value.direction==='O'?'outbound':'inbound'))}</strong><p>${esc(i18n.officialText(value.stopName))}</p></section>`;
    el('back-setup').append(button(t(editingCommute?'backHome':setupFromSearch?'backToStops':'backToRoutes'),()=>{if(editingCommute){selected=null;show('home');}else if(setupFromSearch){resumeStops();}else{reset();page='routes';message();window.scrollTo(0,0);renderPage();}},'quiet'));
    if(!planDraft)planDraft={active:value.activePreset??'regular',plans:timePlans(value)};
    const activeTimes=planDraft.plans[planDraft.active];
    screen.insertAdjacentHTML('beforeend', `<label for="label">${esc(t('commuteName'))}</label><input id="label" maxlength="100" value="${esc(formDraft?.label ?? value.label ?? t('myCommute'))}">`);
    screen.insertAdjacentHTML('beforeend',`<details id="optional-plans" ${plansOpen?'open':''}><summary>${esc(t('optionalPlans'))}</summary><div id="edit-plans" class="plan-options" role="group" aria-label="${esc(t('plansTitle'))}"></div><p class="sub">${esc(t('plansHelp'))}</p></details>`);
    el('optional-plans').ontoggle=()=>{plansOpen=el('optional-plans').open;};
    for(const id of PLAN_IDS){const choice=button(t(id),()=>{captureDrafts();planDraft.active=id;formDraft={...formDraft,walk:planDraft.plans[id].walkMinutes,buffer:planDraft.plans[id].bufferMinutes};renderPage();});choice.setAttribute('aria-pressed',String(planDraft.active===id));choice.dataset.testid='plan-'+id;el('edit-plans').append(choice);}
    screen.insertAdjacentHTML('beforeend', `<div class="time-fields"><div><label for="walk">${esc(t('walkMinutes'))}</label><input id="walk" type="number" min="0" max="180" step="any" value="${esc(formDraft?.walk ?? activeTimes.walkMinutes)}"></div><div><label for="buffer">${esc(t('bufferMinutes'))}</label><input id="buffer" type="number" min="0" max="180" step="any" value="${esc(formDraft?.buffer ?? activeTimes.bufferMinutes)}"></div></div>`);
    screen.insertAdjacentHTML('beforeend',`<p class="sub manual-times">${esc(t('manualTimes'))}</p><p id="timing-example" class="reason-card" aria-live="polite"></p>`);
    const updateExample=()=>{
      const walk=Number(el('walk').value), buffer=Number(el('buffer').value);
      el('timing-example').textContent=el('walk').value!==''&&el('buffer').value!==''&&[walk,buffer].every(v=>Number.isFinite(v)&&v>=0&&v<=180)
        ? t(walk+buffer>10?'timingLater':'timingExample',{walk,buffer,leave:Number((10-walk-buffer).toFixed(2))}) : t('validTimes');
    };
    el('walk').oninput=updateExample;el('buffer').oninput=updateExample;updateExample();
    screen.append(button(t('save'), () => {
      if (!el('walk').value || !el('buffer').value) { message('enterTimes'); return; }
      const walkMinutes = Number(el('walk').value), bufferMinutes = Number(el('buffer').value), label = el('label').value.trim();
      if (![walkMinutes, bufferMinutes].every(n => Number.isFinite(n) && n >= 0 && n <= 180)) { message('validTimes'); return; }
      if (!label || label.length > 100) { message('validName'); return; }
      captureDrafts();
      const plans=Object.fromEntries(PLAN_IDS.map(id=>[id,{walkMinutes:Number(planDraft.plans[id].walkMinutes),bufferMinutes:Number(planDraft.plans[id].bufferMinutes)}]));
      if(PLAN_IDS.some(id=>Object.values(planDraft.plans[id]).some(v=>v==='')) || !Object.values(plans).every(p=>Object.values(p).every(n=>Number.isFinite(n)&&n>=0&&n<=180))){message('validTimes');return;}
      try { current = bus.favourites.save({...value, label, walkMinutes, bufferMinutes,timePresets:plans,activePreset:planDraft.active}); selected = null; show('home'); message('commuteSaved'); } catch (e) { fail(e); }
    }, 'primary save-commute'));
  }
}
function resultStops(){return searchResult?.routeFilter ? searchService?.stops??[] : searchResult?.stops??nearbyResult?.stops??[];}
function boardStop(stop){
  if(searchService)openSetup({stopId:stop.id,route:searchService.route,direction:searchService.direction,serviceType:searchService.serviceType,stopSequence:stop.stopSequence,origin:searchService.origin,destination:searchService.destination,stopName:stop.name,stopPoint:{latitude:stop.latitude,longitude:stop.longitude}},false,true);
  else loadRoutes(stop,searchResult?.routeFilter);
}
function chooseStop(stop,fromMap=false){
  focusedStopId=stop.id;
  document.querySelectorAll('.stop-select').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stopId===stop.id)));
  renderSelectedStop();
  if(!fromMap){mapInstance?.select(stop.id);el('selected-stop').scrollIntoView({block:'nearest'});}
}
function renderSelectedStop(){
  const host=el('selected-stop');if(!host)return;
  const stop=resultStops().find(s=>s.id===focusedStopId);host.hidden=!stop;if(!stop)return;
  host.innerHTML=`<p class="eyebrow">${esc(t('selectedStop'))}</p><h3>${esc(i18n.officialText(stop.name))}</h3><p class="sub">${esc(t('chooseRoute'))}</p>`;
  host.append(button(t('busRoutes'),()=>loadRoutes(stop,searchResult?.routeFilter),'primary'),navigationLink(stop,'secondary'),stopDetails(stop));
}
function renderStops(){
  if(!el('results'))return;
  const stops=resultStops();
  if(searchResult?.routeFilter){
    el('result-summary').textContent=t(searchService?'routeOrder':'chooseDirection');
    if(!searchService){
      el('results').innerHTML='<div id="service-choices"></div>';
      for(const service of searchResult.services){
        el('service-choices').append(button(`${service.route} → ${i18n.officialText(service.destination)||t(service.direction==='O'?'outbound':'inbound')} · ${t('serviceVariant',{service:service.serviceType})}`,()=>{searchService=service;focusedStopId=null;renderPage();},'choice'));
      }
      if(!searchResult.services.length)el('result-summary').textContent=t('searchEmpty');
      return;
    }
  }
  if(!searchResult?.routeFilter)el('result-summary').textContent=searchResult?searchResult.total>stops.length?t('searchMore',{count:stops.length,total:searchResult.total}):t(searchResult.total?'searchCount':'searchEmpty',{count:searchResult.total}):'';
  el('results').replaceChildren(...stops.map((stop,index)=>{
    const choice=button('',()=>chooseStop(stop),'choice stop-select');choice.dataset.stopId=stop.id;
    choice.setAttribute('aria-label',`${index+1}. ${i18n.officialText(stop.name)}`);choice.setAttribute('aria-pressed',String(stop.id===focusedStopId));
    choice.innerHTML=`<span class="stop-number" aria-hidden="true">${index+1}</span><span class="stop-copy"><strong>${esc(i18n.officialText(stop.name))}</strong><span>${esc(Number.isFinite(stop.distanceMeters)?t('distance',{metres:Math.round(stop.distanceMeters)}):t('selectStopHint'))}</span></span>`;
    const card=document.createElement('article');card.className='stop-card';
    if(searchService)choice.querySelector('.stop-number').textContent=stop.stopSequence;
    card.append(choice,button(t('chooseBoarding'),()=>boardStop(stop),'quiet board-stop'));
    return card;
  }));
  if(searchService){
    const heading=document.createElement('p');heading.className='selection-summary';heading.textContent=`${searchService.route} → ${i18n.officialText(searchService.destination)||t(searchService.direction==='O'?'outbound':'inbound')} · ${t('serviceVariant',{service:searchService.serviceType})}`;
    el('results').prepend(heading,button(t('changeDirection'),()=>{searchService=null;focusedStopId=null;renderPage();},'quiet'));
  }
  if(!searchService&&searchResult&&searchResult.total>stops.length)el('results').append(button(t('moreStops'),()=>loadSearch(searchQuery,Math.min(10000,stops.length+40))));
}
function renderMap(){
  if(!mapOpen)return;
  el('map-section').innerHTML=`<h3>${esc(t('mapTitle'))}</h3><p class="sub">${esc(t('mapSelectionHint'))}</p>${!nearbyResult&&!searchResult?`<p class="sub">${esc(t('mapDefault'))}</p>`:''}<div id="stop-map" role="region" aria-label="${esc(t('mapTitle'))}"></div><div id="area-search"></div>`;
  mapInstance=createStopMap(el('stop-map'),{stops:resultStops(),center:nearbyResult?.location,view:mapView,selectedStopId:focusedStopId,t,name:v=>i18n.officialText(v),onSelect:s=>chooseStop(s,true),onStop:s=>loadRoutes(s,searchResult?.routeFilter),onSearch:p=>loadNearby(p),navigationLink});
  el('area-search').append(button(t('mapSearch'),()=>mapInstance.search()));
}
async function loadSearch(query,limit=40){
  captureDrafts();searchQuery=query.trim();if(!searchQuery){message('searchHint');return;}
  reset();const token=generation;searchService=null;searchResult=null;nearbyResult=null;mapView=null;focusedStopId=null;renderPage();message('searchingStops');
  try{const result=await bus.client.searchStops(searchQuery,{signal:controller.signal,limit});if(token!==generation)return;searchResult=result;mapView=null;if(mapInstance){mapInstance.destroy();mapInstance=null;}message();renderPage();}catch(e){if(token===generation)fail(e);}
}
async function loadNearby(point) {
  captureDrafts();reset(); const token = generation; nearbyResult = null;searchService=null;searchResult=null;searchQuery='';focusedStopId=null;
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
    const choice=button('',()=>openSetup({...r,stopName:routeStop.name,stopPoint:{latitude:routeStop.latitude,longitude:routeStop.longitude}}),'choice');
    choice.setAttribute('aria-label',`${r.route} → ${i18n.officialText(r.destination)} · ${t(r.direction==='O'?'outbound':'inbound')}`);
    choice.innerHTML=`<span class="route-number">${esc(r.route)}</span><span class="stop-copy"><strong>→ ${esc(i18n.officialText(r.destination))}</strong><span>${esc(t(r.direction==='O'?'outbound':'inbound'))}</span></span>`;
    const details=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p');
    details.className='service-details';summary.textContent=t('serviceDetails');info.textContent=t('serviceOption',{route:r.route,destination:i18n.officialText(r.destination),direction:t(r.direction==='O'?'outbound':'inbound'),service:r.serviceType,stop:r.stopSequence});
    details.append(summary,info);card.append(choice,details);return card;
  }));
}
async function loadRoutes(stop,filter = null) {
  reset(); const token = generation; page = 'routes'; routeStop = stop; routeResults = null;routeFilter=filter;
  window.scrollTo(0,0); renderPage(); message('loadingRoutes');
  try { const routes = await bus.getRoutesForStop(stop.id, {signal:controller.signal}); if (token !== generation) return;
    routeResults = routeFilter?routes.filter(r=>r.route===routeFilter && (!searchService || (r.direction===searchService.direction && r.serviceType===searchService.serviceType))):routes; message(routeResults.length ? '' : 'noRoutes'); renderRoutes();
  } catch (e) { if (token === generation) fail(e); }
}
document.querySelector('header').append(languageControl('language-select'));
const languageStatus = document.createElement('p'); languageStatus.id = 'language-status'; languageStatus.setAttribute('role', 'status'); document.querySelector('header').append(languageStatus);
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { if(b.dataset.page!=='settings')selected=null; show(b.dataset.page); });
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); else startAdvice(); });
window.addEventListener('pagehide', reset);
renderGlobal(); show('home');
