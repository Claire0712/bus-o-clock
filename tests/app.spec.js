import { test, expect } from '@playwright/test';
const stop='18492910339410B1';
async function api(page) {
 await page.route('https://data.etabus.gov.hk/**', async route => {
  const url=route.request().url(); let data;
  if(url.endsWith('/stop'))data=[{stop,name_en:'Chuk Yuen',name_tc:'竹園',name_sc:'竹园',lat:'22.345415',long:'114.192640'}];
  else if(url.endsWith('/route/'))data=[{route:'1',bound:'O',service_type:'1',dest_en:'Campus',dest_tc:'校園',dest_sc:'校园'}];
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
 await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();await page.getByRole('button',{name:'Use my location'}).click();await expect(page.locator('#status')).toContainText('Location access is blocked');
 await page.getByText('Choose location manually').click();await page.getByRole('button',{name:'Find stops at these coordinates'}).click();await expect(page.locator('#status')).toContainText('Enter both');
});
test('all nine languages persist and fit a narrow screen', async({page}) => {
 await page.setViewportSize({width:320,height:740}); await page.goto('/');
 for (const [code, home] of [['en','Home'],['zh-Hant','首頁'],['zh-Hans','首页'],['ja','ホーム'],['ko','홈'],['fr','Accueil'],['es','Inicio'],['de','Start'],['pt','Início']]) {
  await page.getByTestId('language-select').selectOption(code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.getByRole('button',{name:home,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 await page.reload(); await expect(page.getByTestId('language-select')).toHaveValue('pt');
 await page.getByRole('button',{name:'Definições',exact:true}).click();
 await page.getByTestId('settings-language').selectOption('ko');
 await expect(page.getByTestId('language-select')).toHaveValue('ko');
 await expect(page.getByRole('heading',{name:'앱 언어'})).toBeVisible();
});
test('switching languages keeps results, form drafts, saved labels and live countdowns', async({page}) => {
 await api(page); await page.goto('/');
 await page.getByTestId('language-select').selectOption('zh-Hant');
 await page.getByRole('button',{name:'附近',exact:true}).click();
 await page.getByRole('button',{name:'試用公開示例：竹園邨',exact:true}).click();
 await page.getByRole('button',{name:/竹園 ·/}).click();
 await expect(page.getByRole('button',{name:/1 → 校園/})).toBeVisible();
 await page.getByTestId('language-select').selectOption('zh-Hans');
 await page.getByRole('button',{name:/1 → 校园/}).click();
 await page.getByLabel('通勤名称').fill('我的学校'); await page.getByLabel('步行时间（分钟）').fill('6');
 await page.getByTestId('language-select').selectOption('ja');
 await expect(page.getByLabel('通勤の名前')).toHaveValue('我的学校');
 await expect(page.getByLabel('徒歩時間（分）')).toHaveValue('6');
 await page.getByRole('button',{name:'通勤を保存',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('あと');
 await page.getByTestId('language-select').selectOption('ko');
 await expect(page.locator('#advice')).toContainText('후 출발');
 await expect(page.getByRole('button',{name:'我的学校 · 1',exact:true})).toBeVisible();
 await page.reload(); await expect(page.locator('#advice')).toContainText('후 출발');
});
test('manual input and existing errors translate without requesting location again', async({page}) => {
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 await page.goto('/'); await page.getByRole('button',{name:'Nearby',exact:true}).click();
 await page.getByRole('button',{name:'Use my location',exact:true}).click();
 await page.getByText('Choose location manually',{exact:true}).click();
 await page.getByLabel('Latitude',{exact:true}).fill('22.3');
 await page.getByTestId('language-select').selectOption('ja');
 await expect(page.locator('#status')).toContainText('拒否');
 await expect(page.getByLabel('緯度',{exact:true})).toHaveValue('22.3');
 await expect(page.getByLabel('緯度',{exact:true})).toBeVisible();
});
test('stale and missing ETA never produce a departure countdown',async({page})=>{
 await api(page);
 await page.addInitScript(({stop})=>localStorage.setItem('bus-o-clock.favourites.v1',JSON.stringify({version:1,favourites:[{stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1,label:'Test',walkMinutes:4,bufferMinutes:2}]})),{stop});
 await page.route('**/eta/**',r=>r.fulfill({json:{generated_timestamp:new Date(Date.now()-300000).toISOString(),data:[]}}));
 await page.goto('/');await expect(page.locator('#advice')).toContainText('out of date');
 await page.route('**/eta/**',r=>r.fulfill({json:{generated_timestamp:new Date().toISOString(),data:[]}}));
 await page.getByRole('button',{name:'Refresh arrivals'}).click();await expect(page.locator('#advice')).toContainText('No arrival estimate');
});
