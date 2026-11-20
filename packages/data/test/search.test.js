import test from 'node:test';
import assert from 'node:assert/strict';
import { searchStopCatalogue } from '../src/search.js';
import { createKmbClient } from '../src/kmb.js';
const stops=[{id:'a',name:{en:'Hung Hom',tc:'紅磡',sc:'红磡'}},{id:'b',name:{en:'Hung Hom Station',tc:'紅磡站',sc:'红磡站'}},{id:'c',name:{en:'Terminal',tc:'總站',sc:'总站'}}];
const rows=[{route:'15',bound:'O',service_type:'1',seq:1,stop:'a'},{route:'15',bound:'O',service_type:'1',seq:2,stop:'b'},{route:'15',bound:'O',service_type:'1',seq:3,stop:'c'},{route:'15A',bound:'O',service_type:'1',seq:1,stop:'c'},{route:'15A',bound:'O',service_type:'1',seq:2,stop:'a'}];
test('official Chinese and case-insensitive English names match without location',()=>{
 for(const q of ['hung hom',' 紅磡 ','红磡'])assert.deepEqual(searchStopCatalogue(stops,q).stops.map(s=>s.id),['a','b']);
 assert.equal(searchStopCatalogue(stops,'unknown').total,0);
 assert.equal(searchStopCatalogue(stops,'Hung Hom',{limit:1}).total,2);
 assert.throws(()=>searchStopCatalogue(stops,'   '),{code:'INVALID_INPUT'});
});
test('route numbers match exactly and terminal-only stops are excluded',()=>{
 assert.deepEqual(searchStopCatalogue(stops,'１５',{associations:rows}).stops.map(s=>s.id),['a','b']);
 assert.deepEqual(searchStopCatalogue(stops,'15a',{associations:rows}).stops.map(s=>s.id),['c']);
 assert.equal(searchStopCatalogue(stops,'1',{associations:rows}).total,0);
});
test('a terminal in one direction may still be boardable in the other',()=>{
 const associations=[...rows,{route:'15',bound:'I',service_type:'1',seq:1,stop:'c'},{route:'15',bound:'I',service_type:'1',seq:2,stop:'b'},{route:'15',bound:'I',service_type:'1',seq:3,stop:'a'}];
 assert.equal(searchStopCatalogue(stops,'15',{associations}).total,3);
});
test('client searches catalogue and joins route stops only for route queries',async()=>{
 const calls=[],id='18492910339410B1';
 const client=createKmbClient({storage:null,fetchImpl:async url=>{
  calls.push(url);const data=url.endsWith('/stop')?[{stop:id,name_en:'Hung Hom',name_tc:'紅磡',name_sc:'红磡',lat:'22.3',long:'114.2'}]:url.endsWith('/route/')?[{route:'15',bound:'O',service_type:'1',dest_en:'Terminal'}]:[{route:'15',bound:'O',service_type:'1',seq:1,stop:id},{route:'15',bound:'O',service_type:'1',seq:2,stop:'1111111111111111'}];
  return new Response(JSON.stringify({generated_timestamp:new Date().toISOString(),data}));
 }});
 assert.equal((await client.searchStops('紅磡')).stops[0].id,id);assert.equal(calls.length,1);
 assert.equal((await client.searchStops('15')).routeFilter,'15');assert.equal(calls.length,3);
 const c=new AbortController();c.abort();await assert.rejects(client.searchStops('15',{signal:c.signal}),{code:'ABORTED'});
});
test('route search groups direction and service, preserves sequence and repeated stops',()=>{
 const associations=[...rows,{route:'15',bound:'I',service_type:'1',seq:1,stop:'c'},{route:'15',bound:'I',service_type:'1',seq:2,stop:'a'},
 {route:'15',bound:'O',service_type:'2',seq:1,stop:'a'},{route:'15',bound:'O',service_type:'2',seq:2,stop:'b'},{route:'15',bound:'O',service_type:'2',seq:3,stop:'a'},{route:'15',bound:'O',service_type:'2',seq:4,stop:'c'}];
 const result=searchStopCatalogue(stops,'15',{associations:associations.reverse(),routes:[{route:'15',bound:'O',service_type:'1',dest_en:'Terminal'}]});
 assert.equal(result.services.length,3);
 const outbound=result.services.find(s=>s.direction==='O'&&s.serviceType==='1');
 assert.equal(outbound.destination.en,'Terminal');
 assert.deepEqual(outbound.stops.map(s=>[s.id,s.stopSequence]),[['a',1],['b',2]]);
 assert.deepEqual(result.services.find(s=>s.serviceType==='2').stops.map(s=>s.id),['a','b','a']);
 assert.deepEqual(result.services.find(s=>s.direction==='I').stops.map(s=>s.id),['c']);
});
