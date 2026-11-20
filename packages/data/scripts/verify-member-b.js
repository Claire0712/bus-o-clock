// Run from repository root: node packages/data/scripts/verify-member-b.js <output.json>
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createKmbClient, calculateDeparture } from '../src/index.js';
const client = createKmbClient({ timeoutMs: 20000 });
const stops = await client.getStops();
const response = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-stop/', { signal: AbortSignal.timeout(20000) });
assert.equal(response.ok, true);
const associations = (await response.json()).data;
const live = [];
for (const route of ['1', '1A', '2']) {
  const association = associations.find(r => r.route === route && r.bound === 'O' && String(r.service_type) === '1' && Number(r.seq) === 1);
  assert.ok(association, `Missing ${route} outbound first stop`);
  const stop = stops.find(s => s.id === association.stop);
  assert.ok(stop);
  const services = await client.getRoutesForStop(stop.id);
  const service = services.find(r => r.route === route && r.direction === 'O' && r.serviceType === '1' && r.stopSequence === 1);
  assert.ok(service, 'Catalogue join must preserve full service identity');
  const selection = { ...service, walkMinutes: 4, bufferMinutes: 2 };
  const envelope = await client.getEta(selection);
  const now = Date.now();
  const advice = calculateDeparture(envelope, selection, { now });
  for (const departure of advice.departures) assert.equal(Date.parse(departure.eta) - Date.parse(departure.leaveAt), 360000);
  if (advice.recommended) assert.ok(Date.parse(advice.recommended.leaveAt) >= now);
  live.push({ checkedAt: new Date(now).toISOString(), stop, selection, envelope, advice });
}
const now = Date.parse('2026-11-19T12:00:00+08:00');
const selection = { stopId: '18492910339410B1', route: '1', direction: 'O', serviceType: '1', stopSequence: 1, walkMinutes: 4, bufferMinutes: 2 };
const row = minutes => ({route:'1',dir:'O',service_type:1,seq:1,eta:new Date(now+minutes*60000).toISOString(),data_timestamp:new Date(now).toISOString()});
const fixtures = [
 ['10-minute ETA minus 4-minute walk and 2-minute buffer', [row(10)], 0, 'wait', 240],
 ['Skip 3-minute bus, choose 14-minute bus', [row(3),row(14)], 0, 'wait', 480],
 ['No ETA', [{...row(10),eta:null}], 0, 'no-service', null],
 ['Response older than 120 seconds', [row(10)], 121000, 'stale', null]
];
const calculations = fixtures.map(([name,data,age,status,seconds]) => {
 const envelope={generated_timestamp:new Date(now-age).toISOString(),data};
 const actual=calculateDeparture(envelope,selection,{now});
 assert.equal(actual.status,status);assert.equal(actual.leaveInSeconds,seconds);
 return {name,source:'synthetic deterministic fixture, not live observations',now:new Date(now).toISOString(),selection,envelope,expected:{status,leaveInSeconds:seconds},actual};
});
const report={verifiedAt:new Date().toISOString(),stopCount:stops.length,live,calculations};
await writeFile(process.argv[2] ?? '/tmp/member-b-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stopCount:stops.length,live:live.map(r=>({route:r.selection.route,stop:r.stop.name.en,status:r.advice.status,departures:r.advice.departures.length})),calculationCases:calculations.length},null,2));
