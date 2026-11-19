import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function createStopMap(host, { stops, center, view, t, name, onStop, onSearch }) {
  const map = L.map(host, { zoomControl:false, scrollWheelZoom:false, maxZoom:19 });
  L.control.zoom({zoomInTitle:t('zoomIn'),zoomOutTitle:t('zoomOut')}).addTo(map);
  map.attributionControl.setPrefix(false);
  const tileStatus = document.createElement('p'); tileStatus.className = 'map-note'; tileStatus.setAttribute('role','status'); host.after(tileStatus);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  });
  let failed = false;
  tiles.on('loading',()=>{ if(!failed) tileStatus.textContent=t('mapLoading'); });
  tiles.on('tileerror',()=>{failed=true;tileStatus.textContent=t('mapError');});
  tiles.on('load',()=>{if(!failed)tileStatus.textContent='';});
  tiles.addTo(map);
  const points = stops.map(s=>[s.latitude,s.longitude]);
  if (view) map.setView(view.center,view.zoom);
  else if (points.length) map.fitBounds(L.latLngBounds(points),{padding:[28,28],maxZoom:17});
  else map.setView(center ? [center.latitude,center.longitude] : [22.3193,114.1694],center ? 16 : 12);
  for (const [index,stop] of stops.entries()) {
    const marker = L.marker([stop.latitude,stop.longitude],{
      icon:L.divIcon({className:'stop-pin',html:`<span>${index+1}</span>`,iconSize:[30,30],iconAnchor:[15,15]}),
      title:`${index+1}. ${name(stop.name)} · ${stop.id.slice(-4)}`,alt:`${index+1}. ${name(stop.name)} · ${stop.id.slice(-4)}`,keyboard:true
    }).addTo(map);
    marker.getElement().setAttribute('aria-label',`${index+1}. ${name(stop.name)} · ${stop.id.slice(-4)}`);
    const popup = document.createElement('div');
    const title = document.createElement('strong');title.textContent=name(stop.name);
    const id = document.createElement('p');id.textContent=`${t('stopId')} ${stop.id.slice(-4)}`;
    const choose = document.createElement('button');choose.className='btn primary';choose.textContent=t('mapRoutes');choose.onclick=()=>onStop(stop);
    popup.append(title,id,choose);marker.bindPopup(popup);
  }
  if(center) L.circleMarker([center.latitude,center.longitude],{radius:6,color:'#302B40',fillColor:'#FFFFFF',fillOpacity:1,weight:3}).addTo(map);
  map.on('click',e=>map.panTo(e.latlng));
  return {
    search:()=>{const p=map.getCenter();onSearch({latitude:p.lat,longitude:p.lng});},
    view:()=>({center:map.getCenter(),zoom:map.getZoom()}),
    destroy:()=>{map.remove();tileStatus.remove();}
  };
}
