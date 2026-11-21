import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';

const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStopMap(host, { stops, center, view, selectedStopId, t, name, onSelect, onStop, onSearch, navigationLink }) {
  const map = L.map(host, { zoomControl:false, scrollWheelZoom:false, maxZoom:19 });
  let alive = true, selected = selectedStopId;
  const zoom=L.control.zoom({zoomInTitle:t('zoomIn'),zoomOutTitle:t('zoomOut')}).addTo(map);
  map.on('popupopen',()=>{zoom.getContainer().hidden=true;});
  map.on('popupclose',()=>{zoom.getContainer().hidden=false;});
  map.attributionControl.setPrefix(false);
  const tileStatus = document.createElement('p'); tileStatus.className = 'map-note'; tileStatus.setAttribute('role','status'); host.after(tileStatus);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  });
  let failed = false;
  tiles.on('loading',()=>{if(!failed)tileStatus.textContent=t('mapLoading');});
  tiles.on('tileerror',()=>{failed=true;tileStatus.textContent=t('mapError');});
  tiles.on('load',()=>{if(!failed)tileStatus.textContent='';});
  tiles.addTo(map);
  const points = stops.map(s=>[s.latitude,s.longitude]);
  if(view)map.setView(view.center,view.zoom);
  else if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[34,34],maxZoom:17});
  else map.setView(center?[center.latitude,center.longitude]:[22.3193,114.1694],center?16:12);
  const clusters = L.markerClusterGroup({
    maxClusterRadius:42,showCoverageOnHover:false,spiderfyOnMaxZoom:true,spiderfyDistanceMultiplier:1.5,
    animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,
    iconCreateFunction:cluster=>L.divIcon({className:'stop-cluster',iconSize:[42,42],html:`<span aria-label="${escape(t('clusterLabel',{count:cluster.getChildCount()}))}">${cluster.getChildCount()}</span>`})
  }).addTo(map);
  const markers = new Map();
  const icon=(index,active)=>L.divIcon({className:'stop-pin'+(active?' is-selected':''),html:`<span>${index+1}</span>`,iconSize:[32,32],iconAnchor:[16,16]});
  const decorate=(marker,stop,index)=>{
    const element=marker.getElement();
    if(element){element.setAttribute('aria-label',`${index+1}. ${name(stop.name)}`);element.setAttribute('aria-pressed',String(selected===stop.id));}
  };
  function highlight(id){
    selected=id;
    stops.forEach((stop,index)=>{const marker=markers.get(stop.id);marker.setIcon(icon(index,selected===stop.id));marker.setZIndexOffset(selected===stop.id?1000:0);decorate(marker,stop,index);});
  }
  stops.forEach((stop,index)=>{
    const marker=L.marker([stop.latitude,stop.longitude],{icon:icon(index,selected===stop.id),title:`${index+1}. ${name(stop.name)}`,keyboard:true});
    markers.set(stop.id,marker);marker.on('add',()=>decorate(marker,stop,index));
    const popup=document.createElement('div');popup.className='stop-popup';
    const title=document.createElement('strong');title.textContent=name(stop.name);
    const details=document.createElement('details'),summary=document.createElement('summary'),id=document.createElement('p');
    summary.textContent=t('stopDetails');id.textContent=`ID: ${stop.id}`;details.append(summary,id);
    const hint=document.createElement('p');hint.className='sub';hint.textContent=t('navigationProvider');
    const routes=document.createElement('button');routes.className='btn secondary';routes.textContent=t('busRoutes');routes.onclick=()=>onStop(stop);
    popup.append(title,navigationLink(stop),hint,routes,details);
    marker.bindPopup(popup,{maxWidth:260,minWidth:190});
    marker.on('click',()=>{highlight(stop.id);onSelect(stop);});
    clusters.addLayer(marker);
  });
  if(center)L.circleMarker([center.latitude,center.longitude],{radius:6,color:'#203D3D',fillColor:'#FFFFFF',fillOpacity:1,weight:3}).addTo(map);
  map.on('click',e=>map.panTo(e.latlng));
  return {
    select(id){highlight(id);const marker=markers.get(id);if(marker)clusters.zoomToShowLayer(marker,()=>{if(alive)marker.openPopup();});},
    search:()=>{const p=map.getCenter();onSearch({latitude:p.lat,longitude:p.lng});},
    view:()=>({center:map.getCenter(),zoom:map.getZoom()}),
    destroy:()=>{alive=false;map.remove();tileStatus.remove();}
  };
}
