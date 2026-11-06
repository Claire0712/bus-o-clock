import { test, expect } from '@playwright/test';
const stop='18492910339410B1';
async function api(page) {
 await page.route('https://data.etabus.gov.hk/**', async route => {
  const url=route.request().url(); let data;
  if(url.endsWith('/stop'))data=[{stop,name_en:'Chuk Yuen',lat:'22.345415',long:'114.192640'}];
  else if(url.endsWith('/route/'))data=[{route:'1',bound:'O',service_type:'1',dest_en:'Campus'}];
  else if(url.endsWith('/route-stop/'))data=[{stop,route:'1',bound:'O',service_type:'1',seq:1},{stop:'1111111111111111',route:'1',bound:'O',service_type:'1',seq:2}];
  else data=[{route:'1',dir:'O',service_type:1,seq:1,eta:new Date(Date.now()+600000).toISOString(),data_timestamp:new Date().toISOString()}];
  await route.fulfill({json:{generated_timestamp:new Date().toISOString(),data}});
 });
}
test('select real-shaped service, save, reload, refresh failure and delete',async({page})=>{
 await api(page);await page.goto('/');await page.getByRole('button',{name:'Find a stop'}).click();
 await page.getByRole('button',{name:/Try public example/}).click();await page.getByRole('button',{name:/Chuk Yuen ·/}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();await page.getByLabel('Commute name').fill('School');await page.getByRole('button',{name:'Save commute'}).click();
 await expect(page.locator('#advice')).toContainText('Leave in');await page.reload();await expect(page.locator('#advice')).toContainText('Leave in');
 await page.route('**/eta/**',r=>r.abort());await page.getByRole('button',{name:'Refresh arrivals'}).click();await expect(page.locator('#advice')).toContainText('Cannot load');
 await page.getByRole('button',{name:'Delete commute'}).click();await expect(page.getByRole('button',{name:'Find a stop'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('denied location displays fallback and empty manual coordinates are rejected',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();await page.getByRole('button',{name:'Use my location'}).click();await expect(page.locator('#status')).toContainText('LOCATION_DENIED');
 await page.getByText('Choose location manually').click();await page.getByRole('button',{name:'Find stops at these coordinates'}).click();await expect(page.locator('#status')).toContainText('Enter both');
});
test('stale and missing ETA never produce a departure countdown',async({page})=>{
 await api(page);
 await page.addInitScript(({stop})=>localStorage.setItem('bus-o-clock.favourites.v1',JSON.stringify({version:1,favourites:[{stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1,label:'Test',walkMinutes:4,bufferMinutes:2}]})),{stop});
 await page.route('**/eta/**',r=>r.fulfill({json:{generated_timestamp:new Date(Date.now()-300000).toISOString(),data:[]}}));
 await page.goto('/');await expect(page.locator('#advice')).toContainText('out of date');
 await page.route('**/eta/**',r=>r.fulfill({json:{generated_timestamp:new Date().toISOString(),data:[]}}));
 await page.getByRole('button',{name:'Refresh arrivals'}).click();await expect(page.locator('#advice')).toContainText('No arrival estimate');
});
