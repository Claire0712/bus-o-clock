import test from 'node:test';
import assert from 'node:assert/strict';
import { timePlans, arrivalDay, recommendationReason } from '../../../journey-tools.js';
import { createI18n } from '../../../i18n.js';

test('legacy commutes get two independent bounded plans; stored plans survive edits',()=>{
 const plans=timePlans({walkMinutes:179,bufferMinutes:180});
 assert.deepEqual(plans,{regular:{walkMinutes:179,bufferMinutes:180},extra:{walkMinutes:180,bufferMinutes:180}});
 const copied=timePlans({timePresets:plans});copied.extra.walkMinutes=7;
 assert.equal(plans.extra.walkMinutes,180);
 assert.equal(timePlans().regular.walkMinutes,4);
});
test('clock labels use Hong Kong time and detect midnight across month/year',()=>{
 const i18n=createI18n({storage:null});
 assert.equal(i18n.formatClock('2026-12-31T16:05:00Z'),'00:05');
 assert.equal(arrivalDay('2026-12-31T16:05:00Z','2026-12-31T15:59:00Z'),true);
 assert.equal(arrivalDay('2026-12-31T15:59:00Z','2026-12-31T15:50:00Z'),false);
});
test('explanation uses the actual recommended departure and is removed on failure/staleness',()=>{
 const commute={walkMinutes:4,bufferMinutes:2},first={eta:1000},chosen={eta:9000};
 const state={status:'wait',skippedCount:1,recommended:chosen,departures:[first,chosen]};
 assert.deepEqual(recommendationReason(state,commute),{key:'reasonSkipped',values:{walk:4,buffer:2},firstEta:1000,chosenEta:9000});
 assert.equal(recommendationReason({...state,skippedCount:0},commute).key,'reasonFits');
 for(const status of ['loading','error','stale','no-service','too-late'])assert.equal(recommendationReason({...state,status},commute),null);
});
