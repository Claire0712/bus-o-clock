import test from 'node:test';
import assert from 'node:assert/strict';
import { walkingDirectionsUrl } from '../../../navigation.js';

test('walking directions target the exact public stop without leaking an origin',()=>{
 const url=new URL(walkingDirectionsUrl({latitude:22.345415,longitude:114.192640,accuracyMeters:18}));
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/maps/dir/');
 assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('travelmode'),'walking');
 assert.equal(url.searchParams.get('destination'),'22.345415,114.19264');assert.equal(url.searchParams.get('dir_action'),'navigate');
 assert.equal(url.searchParams.has('origin'),false);assert.equal(url.searchParams.has('accuracyMeters'),false);
});
test('invalid stop locations never turn into navigation to an unrelated destination',()=>{
 for(const point of [null,{}, {latitude:NaN,longitude:114}, {latitude:91,longitude:114}, {latitude:22,longitude:181}, {latitude:'22',longitude:'114'}])assert.throws(()=>walkingDirectionsUrl(point),{code:'INVALID_INPUT'});
 assert.equal(new URL(walkingDirectionsUrl({latitude:0,longitude:0})).searchParams.get('destination'),'0,0');
});
