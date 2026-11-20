import L from 'leaflet';
import { validatePoint } from './packages/data/src/validation.js';

// One route-planning session. Language re-renders keep state but never resend coordinates.
export function createWalkingJourney({stop,getLocation,requestRoute}) {
  let host,options,map,view,origin,source,route,picking=false,loading=false,notice='',request,sequence=0,disposed=false,fit=true;
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
  const btn=(text,action,style='secondary')=>{const b=node('button',text,'btn '+style);b.onclick=action;return b;};
  const link=(text,url)=>{const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
  function unmount(){if(map){view={center:map.getCenter(),zoom:map.getZoom()};map.remove();map=null;}host=null;}
  function redraw(){if(host?.isConnected&&!disposed){const h=host;render(h,options);}}
  function cancel(){sequence++;request?.abort();if(loading){loading=false;notice='walkInterrupted';redraw();}}
  function setOrigin(point,mode){cancel();validatePoint(point);origin=point;source=mode;route=null;notice='';picking=false;fit=true;redraw();}
  async function calculate(useDevice){
    if(loading)return;
    const token=++sequence;request?.abort();request=new AbortController();loading=true;route=null;notice=useDevice?'searchingDevice':'walkLoading';redraw();
    try{
      if(useDevice){const point=await getLocation();if(disposed||token!==sequence)return;validatePoint(point);origin=point;source='device';}
      if(!origin)throw Object.assign(new Error(),{code:'INVALID_INPUT'});
      notice='walkLoading';fit=true;redraw();
      const result=await requestRoute(origin,stop,{signal:request.signal});
      if(disposed||token!==sequence)return;route=result;notice='';fit=true;
    }catch(e){
      if(disposed||token!==sequence)return;
      const keys={LOCATION_DENIED:'locationDenied',LOCATION_UNAVAILABLE:'locationUnavailable',LOCATION_TIMEOUT:'locationTimeout',WALK_TOO_FAR:'walkTooFar',WALK_NO_ROUTE:'walkNoRoute',WALK_RATE_LIMIT:'walkRateLimit',ABORTED:'walkInterrupted',INVALID_INPUT:'invalidInput'};
      notice=keys[e.code]||'walkNetwork';
    }finally{if(!disposed&&token===sequence){loading=false;redraw();}}
  }
  function render(target,config){
    unmount();host=target;options=config;const {t,name,back}=config;
    host.replaceChildren(btn(t('walkBack'),back,'quiet'),node('h2',t('walkTitle')),node('p',name(stop.name),'page-intro'));
    const privacy=node('p',t('walkPrivacy'),'sub walking-privacy');privacy.append(' ',link('FOSSGIS', 'https://routing.openstreetmap.de/about.html'));host.append(privacy);
    const actions=node('div',null,'walking-actions');
    const gps=btn(t('walkDevice'),()=>calculate(true),'primary');gps.dataset.testid='walk-device';gps.disabled=loading;
    const manual=btn(t('walkManual'),()=>{cancel();picking=!picking;notice='';redraw();});manual.disabled=loading;manual.setAttribute('aria-pressed',String(picking));
    actions.append(gps,manual);host.append(actions);
    const alert=node('p',notice?t(notice):picking?t('walkPickHint'):'','walking-status');alert.id='walking-status';alert.setAttribute('role','status');host.append(alert);
    const mapHost=node('div');mapHost.id='walking-map';mapHost.setAttribute('role','region');mapHost.setAttribute('aria-label',t('walkTitle'));host.append(mapHost);
    map=L.map(mapHost,{zoomControl:false,scrollWheelZoom:false,maxZoom:19});L.control.zoom({zoomInTitle:t('zoomIn'),zoomOutTitle:t('zoomOut')}).addTo(map);map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS / OSRM</a> | <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Fix the map</a>');
    const tileWarning=node('p',null,'map-note');tileWarning.setAttribute('role','status');host.append(tileWarning);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).on('tileerror',()=>{tileWarning.textContent=t('walkMapError');}).addTo(map);
    const dest=[stop.latitude,stop.longitude];
    const marker=(point,label,kind)=>{const m=L.marker(point,{icon:L.divIcon({className:'walking-pin '+kind,html:kind==='origin'?'●':'⚑',iconSize:[28,28],iconAnchor:[14,14]}),title:label}).addTo(map).bindTooltip(()=>node('span',label));m.getElement()?.setAttribute('aria-label',label);return m;};
    marker(dest,t('walkDestination')+': '+name(stop.name),'destination');
    if(origin){
      marker([origin.latitude,origin.longitude],t('walkStart')+': '+t(source),'origin');
      const originText=node('p',`${t('walkStart')} · ${t(source)} · ${origin.latitude.toFixed(5)}, ${origin.longitude.toFixed(5)}`,'sub');originText.id='walking-origin';
      if(source==='device'&&Number.isFinite(origin.accuracyMeters))originText.append(' · '+t('accuracy',{metres:Math.round(origin.accuracyMeters)}));host.append(originText);
    }
    if(route){
      L.polyline(route.coordinates,{color:'#FFFFFF',weight:9,opacity:1,interactive:false}).addTo(map);
      L.polyline(route.coordinates,{color:'#65528E',weight:5,opacity:1,className:'walking-route-line',interactive:false}).addTo(map);
      const summary=node('p',t('walkSummary',{minutes:Math.max(1,Math.ceil(route.durationSeconds/60)),metres:Math.round(route.distanceMeters)}),'walking-summary');summary.id='walking-summary';host.append(summary);
      host.append(node('p',t('walkPreview'),'sub'));
    }
    const bounds=route?L.latLngBounds([...route.coordinates,dest,[origin.latitude,origin.longitude]]):origin?L.latLngBounds([dest,[origin.latitude,origin.longitude]]):null;
    if(fit&&bounds){map.fitBounds(bounds,{padding:[28,28],maxZoom:18});fit=false;}
    else if(view)map.setView(view.center,view.zoom);
    else map.setView(dest,16);
    map.on('click',e=>{if(picking&&!loading)setOrigin({latitude:e.latlng.lat,longitude:e.latlng.lng},'manual');});
    if(picking)host.append(btn(t('walkUseCentre'),()=>{const p=map.getCenter();setOrigin({latitude:p.lat,longitude:p.lng},'manual');}));
    if(origin){const compute=btn(t('walkCompute'),()=>calculate(false),route?'secondary':'primary');compute.disabled=loading;compute.dataset.testid='walk-compute';host.append(compute);}
    if(route)host.append(btn(t('walkFit'),()=>{map.fitBounds(bounds,{padding:[28,28],maxZoom:18});}));
    const details=node('details');details.className='walking-coordinates';details.append(node('summary',t('manualLocation')));
    const form=node('form');
    for(const key of ['latitude','longitude']){const label=node('label',t(key));label.htmlFor='walk-'+key;const input=node('input');input.id=label.htmlFor;input.type='number';input.step='any';input.min=key==='latitude'?'-90':'-180';input.max=key==='latitude'?'90':'180';input.required=true;input.value=origin?.[key]??'';form.append(label,input);}
    const submit=btn(t('walkCompute'),()=>{},'secondary');submit.type='submit';submit.disabled=loading;form.append(submit);
    form.onsubmit=e=>{e.preventDefault();try{setOrigin({latitude:Number(form.querySelector('#walk-latitude').value),longitude:Number(form.querySelector('#walk-longitude').value)},'manual');calculate(false);}catch{notice='invalidInput';redraw();}};
    details.append(form);host.append(details);
  }
  return {render,unmount,cancel,dispose(){disposed=true;sequence++;request?.abort();unmount();}};
}
