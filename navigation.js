import { DataError, validatePoint } from './packages/data/src/validation.js';
import { distanceMeters } from './packages/data/src/location.js';

export const WALKING_SERVICE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const error = code => new DataError(code, code);
export function walkingRouteUrl(origin, destination) {
  validatePoint(origin); validatePoint(destination);
  if (distanceMeters(origin,destination)>30_000) throw error('WALK_TOO_FAR');
  const coordinates=[origin,destination].map(p=>`${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(';');
  return WALKING_SERVICE+coordinates+'?overview=full&geometries=geojson&steps=false&radiuses=100;100&generate_hints=false';
}
export function parseWalkingRoute(body, origin, destination) {
  if(['NoRoute','NoSegment'].includes(body?.code))throw error('WALK_NO_ROUTE');
  const route=body?.routes?.[0],points=route?.geometry?.coordinates,waypoints=body?.waypoints;
  if(body?.code!=='Ok'||route?.geometry?.type!=='LineString'||!Array.isArray(points)||points.length<2||points.length>100_000||!Number.isFinite(route.distance)||route.distance<0||!Number.isFinite(route.duration)||route.duration<0||waypoints?.length!==2)throw error('WALK_INVALID');
  for(const p of points)if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||Math.abs(p[0])>180||!Number.isFinite(p[1])||Math.abs(p[1])>90)throw error('WALK_INVALID');
  const ends=[origin,destination];
  for(let i=0;i<2;i++){
    const p=waypoints[i]?.location;
    if(!Array.isArray(p)||!Number.isFinite(waypoints[i].distance)||waypoints[i].distance<0||waypoints[i].distance>100)throw error('WALK_NO_ROUTE');
    try{if(distanceMeters(ends[i],{longitude:p[0],latitude:p[1]})>110)throw error('WALK_NO_ROUTE');}catch(e){if(e.code==='WALK_NO_ROUTE')throw e;throw error('WALK_INVALID');}
    const endpoint=points[i===0?0:points.length-1];
    if(distanceMeters(ends[i],{longitude:endpoint[0],latitude:endpoint[1]})>110)throw error('WALK_NO_ROUTE');
  }
  return {coordinates:points.map(p=>[p[1],p[0]]),distanceMeters:route.distance,durationSeconds:route.duration,origin:{...origin},destination:{...destination}};
}

// Explicit requests only; keep the provider's <=1 request/second policy.
// No location or route is written to storage or analytics.
export function createWalkingClient({fetchImpl=globalThis.fetch,now=()=>Date.now(),timeoutMs=15_000}={}) {
  let lastRequest=-Infinity;
  return async (origin,destination,{signal}={})=>{
    const url=walkingRouteUrl(origin,destination);
    if(signal?.aborted)throw error('ABORTED');
    if(now()-lastRequest<1100)throw error('WALK_RATE_LIMIT');
    lastRequest=now();
    const controller=new AbortController();let timedOut=false;
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
      const response=await fetchImpl(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
      if(response.status===429)throw error('WALK_RATE_LIMIT');
      if(!response.ok&&response.status!==400)throw error('WALK_NETWORK');
      const body=await response.json();
      if(controller.signal.aborted)throw error('ABORTED');
      return parseWalkingRoute(body,origin,destination);
    }catch(e){
      if(signal?.aborted)throw error('ABORTED');
      if(timedOut)throw error('WALK_TIMEOUT');
      if(e instanceof DataError)throw e;
      throw error('WALK_NETWORK');
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
}
