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
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();await page.getByLabel('Commute name').fill('School');await page.getByRole('button',{name:'Save commute'}).click();
 await expect(page.locator('#advice')).toContainText('Leave in');await page.reload();await expect(page.locator('#advice')).toContainText('Leave in');
 await page.route('**/eta/**',r=>r.abort());await page.getByRole('button',{name:'Refresh arrivals'}).click();await expect(page.locator('#advice')).toContainText('Cannot load');
 await page.getByRole('button',{name:'Delete commute'}).click();await expect(page.getByRole('button',{name:'Find a stop'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('denied location displays fallback and empty manual coordinates are rejected',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();await page.getByRole('button',{name:'Use my location'}).click();await expect(page.locator('#status')).toContainText('Location access is blocked');
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByText('Choose location manually').click();await page.getByRole('button',{name:'Find stops at these coordinates'}).click();await expect(page.locator('#status')).toContainText('Enter both');
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
 await page.getByText('更多選站方式',{exact:true}).click();await page.getByRole('button',{name:'試用公開示例：竹園邨',exact:true}).click();
 await page.locator('#results').getByRole('button',{name:/竹園/}).click();await page.locator('#selected-stop').getByRole('button',{name:'查看巴士路線',exact:true}).click();
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
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByText('Choose location manually',{exact:true}).click();
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

test('search without location, map selection and exact saved stop identity',async({page})=>{
 await api(page); await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){throw Error('Search must not request location');}}}));
 await page.goto('/'); await page.getByRole('button',{name:'Nearby',exact:true}).click();
 await page.getByLabel('Stop name or route number',{exact:true}).fill('竹園');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('#results')).toContainText('Chuk Yuen');
 await page.getByLabel('Stop name or route number',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('#result-summary')).toContainText('1 stops found');
 await page.getByRole('button',{name:'Show map',exact:true}).click();
 await expect(page.locator('.map-note')).toContainText('stop list or search');
 await page.locator('#stop-map').getByRole('button',{name:'1. Chuk Yuen',exact:true}).click();
 await page.locator('.leaflet-popup-content').getByRole('button',{name:'View bus services',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();
 await page.getByRole('button',{name:'Save commute',exact:true}).click();
 await expect(page.locator('.saved-stop')).toContainText('Chuk Yuen → Campus');
 await page.reload();await page.locator('#saved-stop-details summary').click();await expect(page.locator('#saved-stop-details')).toContainText('18492910339410B1');
});
test('editable time plans survive language changes, reload and quick switching',async({page})=>{
 await api(page);await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();await page.getByLabel('Walking minutes',{exact:true}).fill('6');
 await page.getByTestId('plan-extra').click();await page.getByLabel('Walking minutes',{exact:true}).fill('9');
 await page.getByTestId('language-select').selectOption('ja');await expect(page.locator('#walk')).toHaveValue('9');
 await page.getByTestId('plan-regular').click();await expect(page.locator('#walk')).toHaveValue('6');
 await page.getByTestId('plan-extra').click();await expect(page.locator('#walk')).toHaveValue('9');
 await page.getByTestId('language-select').selectOption('en');await page.getByRole('button',{name:'Save commute',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('too soon');
 await page.reload();await expect(page.getByTestId('quick-extra')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('quick-regular').click();await expect(page.locator('#advice')).toContainText('Leave in');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#walk')).toHaveValue('6');
 await page.getByTestId('plan-extra').click();await expect(page.locator('#walk')).toHaveValue('9');
});
test('absolute arrivals and recommended-bus reason reflect live estimates, then clear on failure',async({page})=>{
 await api(page);
 await page.addInitScript(({stop})=>localStorage.setItem('bus-o-clock.favourites.v1',JSON.stringify({version:1,favourites:[{stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1,label:'School',walkMinutes:4,bufferMinutes:2}]})),{stop});
 await page.route('**/eta/**',r=>r.fulfill({json:{generated_timestamp:new Date().toISOString(),data:[2,12].map(minutes=>({route:'1',dir:'O',service_type:1,seq:1,eta:new Date(Date.now()+minutes*60000).toISOString(),data_timestamp:new Date().toISOString()}))}}));
 await page.goto('/');await expect(page.locator('#arrivals')).toContainText(/Expected \d\d:\d\d/);
 await expect(page.locator('#reason')).toContainText('first bus');await expect(page.locator('#reason')).toContainText('4-minute walk + 2-minute buffer');
 await expect(page.locator('.recommended-arrival')).toHaveCount(1);
 await page.route('**/eta/**',r=>r.abort());await page.getByRole('button',{name:'Refresh arrivals',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('Cannot load');await expect(page.locator('#why')).toBeHidden();await expect(page.locator('#arrivals p')).toHaveCount(0);
});
test('search and map fit all nine languages on a narrow phone',async({page})=>{
 await api(page);await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.setViewportSize({width:320,height:740});await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.getByRole('button',{name:'Show map',exact:true}).click();
 for(const code of ['en','zh-Hant','zh-Hans','ja','ko','fr','es','de','pt']){
  await page.getByTestId('language-select').selectOption(code);await expect(page.locator('#stop-map')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
});


test('clustered stops expand and map/list selection stays in sync with the navigation destination',async({page})=>{
 await api(page);await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 const other='1111111111111111';
 await page.route('**/kmb/stop',r=>r.fulfill({json:{generated_timestamp:new Date().toISOString(),data:[
  {stop,name_en:'North platform',name_tc:'北站台',name_sc:'北站台',lat:'22.345415',long:'114.192640'},
  {stop:other,name_en:'South platform',name_tc:'南站台',name_sc:'南站台',lat:'22.345415',long:'114.192640'}
 ]}}));
 await page.goto('/');await page.getByRole('button',{name:'Nearby',exact:true}).click();
 await expect(page.getByRole('button',{name:/Try public example/})).toBeHidden();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();
 await page.getByRole('button',{name:'Show map',exact:true}).click();
 await expect(page.locator('#stop-map').getByRole('button',{name:'2 stops; expand',exact:true})).toBeVisible();
 await page.locator('#results').getByRole('button',{name:'2. South platform',exact:true}).click();
 await expect(page.locator('#results').getByRole('button',{name:'2. South platform',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#stop-map').getByRole('button',{name:'2. South platform',exact:true})).toHaveAttribute('aria-pressed','true');
 const link=page.locator('.leaflet-popup-content').getByRole('link',{name:'Walk to this stop ↗',exact:true});
 await expect(link).toBeVisible();expect(new URL(await link.getAttribute('href')).searchParams.get('destination')).toBe('22.345415,114.19264');
 expect(new URL(await link.getAttribute('href')).searchParams.has('origin')).toBe(false);
 await expect(page.locator('#selected-stop')).toContainText('South platform');
 await page.getByTestId('language-select').selectOption('ja');await expect(page.locator('#selected-stop')).toContainText('South platform');
 await expect(page.locator('#results').getByRole('button',{name:'2. South platform',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('legacy commutes resolve their official stop for navigation and hide technical details by default',async({page})=>{
 await api(page);await page.addInitScript(({stop})=>localStorage.setItem('bus-o-clock.favourites.v1',JSON.stringify({version:1,favourites:[{stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1,label:'Legacy',walkMinutes:4,bufferMinutes:2}]})),{stop});
 await page.goto('/');const link=page.locator('#saved-navigation .walking-link');await expect(link).toBeVisible();
 expect(new URL(await link.getAttribute('href')).searchParams.get('destination')).toBe('22.345415,114.19264');
 await expect(page.locator('#saved-stop-details p')).toBeHidden();
 await page.locator('#saved-stop-details summary').click();await expect(page.locator('#saved-stop-details p')).toContainText(stop);
 await expect(page.locator('#advice')).toContainText('Leave in');
});
