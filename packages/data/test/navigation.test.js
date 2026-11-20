import test from 'node:test';
import assert from 'node:assert/strict';
import { walkingRouteUrl, parseWalkingRoute, createWalkingClient } from '../../../navigation.js';
const origin={latitude:22.3411,longitude:114.1931},destination={latitude:22.345415,longitude:114.19264};
const response=()=>({code:'Ok',routes:[{distance:863.2,duration:690.5,geometry:{type:'LineString',coordinates:[[114.1931,22.3411],[114.193,22.344],[114.19264,22.345415]]}}],waypoints:[{distance:0,location:[114.1931,22.3411]},{distance:0,location:[114.19264,22.345415]}]});
const ok=body=>({ok:true,status:200,json:async()=>body});
test('walking endpoint uses dedicated foot routing, explicit origin and bounded road snapping',()=>{
 const url=new URL(walkingRouteUrl(origin,destination));
 assert.equal(url.origin,'https://routing.openstreetmap.de');assert.match(url.pathname,/routed-foot\/route\/v1\/foot\/114\.193100,22\.341100;114\.192640,22\.345415$/);
 assert.equal(url.searchParams.get('radiuses'),'100;100');assert.equal(url.searchParams.get('geometries'),'geojson');
 for(const point of [null,{}, {latitude:NaN,longitude:114}, {latitude:91,longitude:114}, {latitude:22,longitude:181}, {latitude:'22',longitude:'114'}])assert.throws(()=>walkingRouteUrl(point,destination),{code:'INVALID_INPUT'});
 assert.throws(()=>walkingRouteUrl({latitude:0,longitude:0},destination),{code:'WALK_TOO_FAR'});
});
test('road geometry and service estimates are preserved without replacing them with straight-line distance',()=>{
 const result=parseWalkingRoute(response(),origin,destination);
 assert.deepEqual(result.coordinates,[[22.3411,114.1931],[22.344,114.193],[22.345415,114.19264]]);
 assert.equal(result.distanceMeters,863.2);assert.equal(result.durationSeconds,690.5);
});
test('no route, missing geometry and excessive road snapping are rejected',()=>{
 for(const code of ['NoRoute','NoSegment'])assert.throws(()=>parseWalkingRoute({code},origin,destination),{code:'WALK_NO_ROUTE'});
 for(const mutate of [b=>b.routes[0].geometry.coordinates=[],b=>b.routes[0].geometry.coordinates[1]=[NaN,22],b=>b.routes[0].distance=-1,b=>b.routes[0].duration=null]){
  const b=response();mutate(b);assert.throws(()=>parseWalkingRoute(b,origin,destination),{code:'WALK_INVALID'});
 }
 const b=response();b.waypoints[0].distance=101;assert.throws(()=>parseWalkingRoute(b,origin,destination),{code:'WALK_NO_ROUTE'});
 const wrong=response();wrong.routes[0].geometry.coordinates[0]=[114.1,22.3];assert.throws(()=>parseWalkingRoute(wrong,origin,destination),{code:'WALK_NO_ROUTE'});
});
test('requests omit credentials and enforce request pacing without automatic retries',async()=>{
 let time=0,calls=0;
 const request=createWalkingClient({now:()=>time,fetchImpl:async(url,options)=>{calls++;assert.equal(options.credentials,'omit');return ok(response());}});
 await request(origin,destination);await assert.rejects(request(origin,destination),{code:'WALK_RATE_LIMIT'});assert.equal(calls,1);
 time=1100;await request(origin,destination);assert.equal(calls,2);
});
test('provider failures are explicit and never fabricate a path',async()=>{
 for(const [fetchImpl,code] of [
  [async()=>{throw new TypeError('offline');},'WALK_NETWORK'],
  [async()=>({ok:false,status:429}),'WALK_RATE_LIMIT'],
  [async()=>({ok:false,status:500}),'WALK_NETWORK'],
  [async()=>({ok:false,status:400,json:async()=>({code:'NoSegment'})}),'WALK_NO_ROUTE'],
  [async()=>ok({code:'Ok',routes:[]}), 'WALK_INVALID']
 ])await assert.rejects(createWalkingClient({fetchImpl})(origin,destination),{code});
});
test('cancelled and timed-out requests do not return a route',async()=>{
 const waiting=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 await assert.rejects(createWalkingClient({fetchImpl:waiting,timeoutMs:5})(origin,destination),{code:'WALK_TIMEOUT'});
 const abort=new AbortController();const promise=createWalkingClient({fetchImpl:waiting})(origin,destination,{signal:abort.signal});abort.abort();await assert.rejects(promise,{code:'ABORTED'});
 let calls=0;await assert.rejects(createWalkingClient({fetchImpl:()=>{calls++;}})(origin,destination,{signal:abort.signal}),{code:'ABORTED'});assert.equal(calls,0);
});
