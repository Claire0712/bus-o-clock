import { test, expect } from '@playwright/test';
async function switchLanguage(page,code){
 await page.locator('nav [data-page=settings]').click();
 await page.getByTestId('settings-language').selectOption(code);
 await page.locator('.return-previous').click();
}
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
 await api(page);await page.goto('/');await page.getByRole('button',{name:'Set up my commute'}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();await page.getByLabel('Commute name').fill('School');await page.getByRole('button',{name:'Save commute'}).click();
 await expect(page.locator('#advice')).toContainText('Leave in');await page.reload();await expect(page.locator('#advice')).toContainText('Leave in');
 await page.route('**/eta/**',r=>r.abort());await page.getByRole('button',{name:'Refresh arrivals'}).click();await expect(page.locator('#advice')).toContainText('Cannot load');
 await page.getByRole('button',{name:'Delete commute'}).click();await expect(page.getByRole('button',{name:'Set up my commute'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('denied location displays fallback and empty manual coordinates are rejected',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 await page.goto('/');await page.getByRole('button',{name:'Find stops',exact:true}).click();await page.getByRole('button',{name:'Use my location'}).click();await expect(page.locator('#status')).toContainText('Location access is blocked');
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByText('Choose location manually').click();await page.getByRole('button',{name:'Find stops at these coordinates'}).click();await expect(page.locator('#status')).toContainText('Enter both');
});
test('all nine languages persist and fit a narrow screen', async({page}) => {
 await page.setViewportSize({width:320,height:740}); await page.goto('/');
 for (const [code, home] of [['en','Home'],['zh-Hant','首頁'],['zh-Hans','首页'],['ja','ホーム'],['ko','홈'],['fr','Accueil'],['es','Inicio'],['de','Start'],['pt','Início']]) {
  await switchLanguage(page,code);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.getByRole('button',{name:home,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 await page.reload(); await expect(page.getByTestId('language-select')).toHaveValue('pt');
 await page.getByRole('button',{name:'Definições',exact:true}).click();
 await page.getByTestId('settings-language').selectOption('ko');
 await expect(page.getByTestId('settings-language')).toHaveValue('ko');
 await expect(page.getByRole('heading',{name:'앱 언어'})).toBeVisible();
});
test('switching languages keeps results, form drafts, saved labels and live countdowns', async({page}) => {
 await api(page); await page.goto('/');
 await switchLanguage(page,'zh-Hant');
 await page.getByRole('button',{name:'找車站',exact:true}).click();
 await page.getByText('更多選站方式',{exact:true}).click();await page.getByRole('button',{name:'試用公開示例：竹園邨',exact:true}).click();
 await page.locator('#results').getByRole('button',{name:/竹園/}).click();await page.locator('#selected-stop').getByRole('button',{name:'查看巴士路線',exact:true}).click();
 await expect(page.getByRole('button',{name:/1 → 校園/})).toBeVisible();
 await switchLanguage(page,'zh-Hans');
 await page.getByRole('button',{name:/1 → 校园/}).click();
 await page.getByLabel('通勤名称').fill('我的学校'); await page.getByLabel('步行时间（分钟）').fill('6');
 await switchLanguage(page,'ja');
 await expect(page.getByLabel('通勤の名前')).toHaveValue('我的学校');
 await expect(page.getByLabel('徒歩時間（分）')).toHaveValue('6');
 await page.getByRole('button',{name:'通勤を保存',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('あと');
 await switchLanguage(page,'ko');
 await expect(page.locator('#advice')).toContainText('후 출발');
 await expect(page.getByRole('button',{name:'我的学校 · 1',exact:true})).toBeVisible();
 await page.reload(); await expect(page.locator('#advice')).toContainText('후 출발');
});
test('manual input and existing errors translate without requesting location again', async({page}) => {
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 await page.goto('/'); await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await page.getByRole('button',{name:'Use my location',exact:true}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByText('Choose location manually',{exact:true}).click();
 await page.getByLabel('Latitude',{exact:true}).fill('22.3');
 await switchLanguage(page,'ja');
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
 await page.goto('/'); await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await page.getByLabel('Stop name or route number',{exact:true}).fill('竹園');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('#results')).toContainText('Chuk Yuen');
 await page.getByLabel('Stop name or route number',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.locator('#service-choices button').click();
 await expect(page.locator('#result-summary')).toContainText('travel order');
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
 await api(page);await page.goto('/');await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();await page.getByLabel('Walking minutes',{exact:true}).fill('6');
 await page.locator('#optional-plans summary').click();await page.getByTestId('plan-extra').click();await page.getByLabel('Walking minutes',{exact:true}).fill('9');
 await switchLanguage(page,'ja');await expect(page.locator('#walk')).toHaveValue('9');
 await page.getByTestId('plan-regular').click();await expect(page.locator('#walk')).toHaveValue('6');
 await page.getByTestId('plan-extra').click();await expect(page.locator('#walk')).toHaveValue('9');
 await switchLanguage(page,'en');await page.getByRole('button',{name:'Save commute',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('too soon');
 await page.reload();await expect(page.getByTestId('quick-extra')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('quick-regular').click();await expect(page.locator('#advice')).toContainText('Leave in');
 await page.getByRole('button',{name:'Edit commute',exact:true}).click();await expect(page.locator('#walk')).toHaveValue('6');
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
 await page.setViewportSize({width:320,height:740});await page.goto('/');await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();await page.getByRole('button',{name:'Show map',exact:true}).click();
 for(const code of ['en','zh-Hant','zh-Hans','ja','ko','fr','es','de','pt']){
  await switchLanguage(page,code);await expect(page.locator('#stop-map')).toBeVisible();
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
 await page.goto('/');await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await expect(page.getByRole('button',{name:/Try public example/})).toBeHidden();
 await page.getByText('More ways to choose a stop',{exact:true}).click();await page.getByRole('button',{name:/Try public example/}).click();
 await page.getByRole('button',{name:'Show map',exact:true}).click();
 await expect(page.locator('#stop-map').getByRole('button',{name:'2 stops; expand',exact:true})).toBeVisible();
 await page.locator('#results').getByRole('button',{name:/^\d+\. South platform$/}).click();
 await expect(page.locator('#results').getByRole('button',{name:/^\d+\. South platform$/})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#stop-map').getByRole('button',{name:/^\d+\. South platform$/})).toHaveAttribute('aria-pressed','true');
 const link=page.locator('.leaflet-popup-content').getByRole('button',{name:'Walk to this stop',exact:true});
 await expect(link).toBeVisible();await link.click();
 await expect(page.locator('#walking-map')).toBeVisible();await expect(page.locator('#screen')).toContainText('South platform');
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.locator('#selected-stop')).toContainText('South platform');
 await switchLanguage(page,'ja');await expect(page.locator('#selected-stop')).toContainText('South platform');
 await expect(page.locator('#results').getByRole('button',{name:/^\d+\. South platform$/})).toHaveAttribute('aria-pressed','true');
});

test('legacy commutes resolve their official stop for navigation and hide technical details by default',async({page})=>{
 await api(page);await page.addInitScript(({stop})=>localStorage.setItem('bus-o-clock.favourites.v1',JSON.stringify({version:1,favourites:[{stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1,label:'Legacy',walkMinutes:4,bufferMinutes:2}]})),{stop});
 await page.goto('/');const link=page.locator('#saved-navigation .walking-link');await expect(link).toBeVisible();
 await expect(page.locator('#saved-stop-details p')).toBeHidden();
 await page.locator('#saved-stop-details summary').click();await expect(page.locator('#saved-stop-details p')).toContainText(stop);
 await expect(page.locator('#advice')).toContainText('Leave in');
 await link.click();await expect(page.locator('#walking-map')).toBeVisible();await expect(page.locator('#screen')).toContainText('Chuk Yuen');
});


const walkingPattern='https://routing.openstreetmap.de/routed-foot/**';
const walkingResponse={code:'Ok',routes:[{distance:863.2,duration:690.5,geometry:{type:'LineString',coordinates:[[114.1931,22.3411],[114.193,22.344],[114.19264,22.345415]]}}],waypoints:[{distance:0,location:[114.1931,22.3411]},{distance:0,location:[114.19264,22.345415]}]};
async function openWalking(page){
 await api(page);await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.goto('/');await page.getByRole('button',{name:'Find stops',exact:true}).click();
 await page.getByLabel('Stop name or route number',{exact:true}).fill('Chuk Yuen');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();
 await page.locator('#selected-stop').getByRole('button',{name:'Walk to this stop',exact:true}).click();
}
async function manualWalk(page){
 await page.locator('.walking-coordinates summary').click();
 await page.locator('#walk-latitude').fill('22.3411');await page.locator('#walk-longitude').fill('114.1931');
 await page.locator('.walking-coordinates').getByRole('button',{name:'Calculate walking route',exact:true}).click();
}
test('device walking route stays in the app and survives nine-language re-render without new routing requests',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:22.3411,longitude:114.1931,accuracy:12});
 let calls=0;await page.route(walkingPattern,r=>{calls++;return r.fulfill({json:walkingResponse});});
 await openWalking(page);expect(calls).toBe(0);await page.getByTestId('walk-device').click();
 await expect(page.locator('#walking-summary')).toContainText('12 min');await expect(page.locator('#walking-summary')).toContainText('863');
 await expect(page.locator('.walking-route-line')).toHaveCount(1);await expect(page.locator('#walking-origin')).toContainText('22.34110');
 await page.setViewportSize({width:320,height:740});
 for(const code of ['en','zh-Hant','zh-Hans','ja','ko','fr','es','de','pt']){
  await switchLanguage(page,code);await expect(page.locator('.walking-route-line')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 expect(calls).toBe(1);expect(context.pages()).toHaveLength(1);
 await expect(page.locator('a[href*="google.com/maps"]')).toHaveCount(0);
});
test('denied location allows a manual starting point; failed recalculation removes the previous path',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>fail({code:1})}}));
 let calls=0;await page.route(walkingPattern,r=>{calls++;return r.fulfill({json:walkingResponse});});
 await openWalking(page);await page.getByTestId('walk-device').click();await expect(page.locator('#walking-status')).toContainText('blocked');expect(calls).toBe(0);
 await manualWalk(page);await expect(page.locator('#walking-summary')).toContainText('863');await expect(page.locator('#walking-origin')).toContainText('manual location');
 await page.waitForTimeout(1150);await page.route(walkingPattern,r=>r.fulfill({json:{code:'NoRoute',routes:[]}}));
 await page.getByTestId('walk-compute').click();await expect(page.locator('#walking-status')).toContainText('No walkable route');
 await expect(page.locator('.walking-route-line')).toHaveCount(0);await expect(page.locator('#walking-summary')).toHaveCount(0);
});
test('leaving the route screen ignores a late response and preserves the selected stop',async({page})=>{
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route(walkingPattern,async r=>{started=true;await gate;try{await r.fulfill({json:walkingResponse});}catch{/* cancelled */}});
 await openWalking(page);await manualWalk(page);await expect.poll(()=>started).toBe(true);
 await page.getByRole('button',{name:'Back',exact:true}).click();release();
 await expect(page.locator('#walking-map')).toHaveCount(0);await expect(page.locator('#selected-stop')).toContainText('Chuk Yuen');
 await expect(page.locator('.walking-route-line')).toHaveCount(0);
});

test('first visit explains the flow; each navigation destination has a distinct job',async({page})=>{
 await api(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'When should I head out?',exact:true})).toBeVisible();
 await expect(page.locator('.welcome-steps li')).toHaveCount(3);
 await expect(page.locator('#screen .btn.primary')).toHaveCount(1);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'App language',exact:true})).toBeVisible();
 await expect(page.locator('#walk')).toHaveCount(0);
 await expect(page.locator('#stop-query')).toHaveCount(0);
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await page.getByRole('button',{name:'Set up my commute',exact:true}).click();
 await expect(page.locator('.setup-progress [aria-current=step]')).toHaveText('1Stop');
 await page.getByLabel('Stop name or route number',{exact:true}).fill('Chuk');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.locator('#results').getByRole('button',{name:/Chuk Yuen/}).click();await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();
 await expect(page.locator('.setup-progress [aria-current=step]')).toHaveText('2Route');
 await page.getByRole('button',{name:/1 → Campus/}).click();
 await expect(page.locator('.setup-progress [aria-current=step]')).toHaveText('3Timing');
 await expect(page.locator('nav [data-page=nearby]')).toHaveAttribute('aria-current','page');
 await expect(page.locator('#settings-language')).toHaveCount(0);
 await page.getByRole('button',{name:'Back to routes',exact:true}).click();
 await expect(page.getByRole('button',{name:/1 → Campus/})).toBeVisible();
 await page.getByRole('button',{name:'Back to stops',exact:true}).click();
 await expect(page.locator('#stop-query')).toHaveValue('Chuk');
 await expect(page.locator('#selected-stop')).toBeVisible();
 await page.locator('#selected-stop').getByRole('button',{name:'View bus services',exact:true}).click();await page.getByRole('button',{name:/1 → Campus/}).click();
 await page.getByLabel('Commute name').fill('Morning');await page.getByRole('button',{name:'Save commute',exact:true}).click();
 await expect(page.locator('nav [data-page=home]')).toHaveAttribute('aria-current','page');
 await expect(page.locator('#advice')).toContainText('Leave in');
 await page.getByRole('button',{name:'Edit commute',exact:true}).click();await page.getByLabel('Walking minutes',{exact:true}).fill('99');
 await page.getByRole('button',{name:'Back to Home',exact:true}).click();
 await page.getByRole('button',{name:'Edit commute',exact:true}).click();await expect(page.locator('#walk')).toHaveValue('4');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#walk')).toHaveCount(0);
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.reload();
 await expect(page.locator('.welcome')).toHaveCount(0);await expect(page.locator('#advice')).toContainText('Leave in');
});

test('review improvements remove duplicate language and explain manual timing',async({page})=>{
 await api(page);await page.goto('/');
 await expect(page.locator('[data-language-picker]:visible')).toHaveCount(1);
 await page.locator('nav [data-page=settings]').click();
 await expect(page.locator('[data-language-picker]:visible')).toHaveCount(1);
 await page.locator('nav [data-page=nearby]').click();
 await expect(page.locator('[data-language-picker]:visible')).toHaveCount(0);
 await page.locator('#stop-query').fill('1');await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('#service-choices')).toContainText('Campus');
 await expect(page.locator('#results .stop-card')).toHaveCount(0);
 await page.locator('#service-choices button').click();
 await page.locator('#results').getByRole('button',{name:'Choose this stop →',exact:true}).click();
 await expect(page.locator('#walk')).toBeVisible();
 await page.getByRole('button',{name:'Back to stops',exact:true}).click();
 await expect(page.locator('#results .stop-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Choose this stop →',exact:true}).click();
 await expect(page.getByTestId('plan-extra')).toBeHidden();
 await expect(page.locator('#timing-example')).toContainText('4 minutes');
 await page.locator('#walk').fill('9');await expect(page.locator('#timing-example')).toContainText('later bus');
});
test('direction-first search saves the selected direction and exact boarding sequence',async({page})=>{
 await api(page);
 const other='1111111111111111';
 await page.route('**/kmb/stop',r=>r.fulfill({json:{data:[
  {stop,name_en:'Same name',lat:22.3,long:114.1},
  {stop:other,name_en:'Same name',lat:22.31,long:114.11}
 ]}}));
 await page.route('**/kmb/route/',r=>r.fulfill({json:{data:[
  {route:'1',bound:'O',service_type:'1',dest_en:'Campus'},
  {route:'1',bound:'I',service_type:'1',dest_en:'Harbour'}
 ]}}));
 await page.route('**/kmb/route-stop/',r=>r.fulfill({json:{data:[
  {route:'1',bound:'O',service_type:'1',seq:1,stop},
  {route:'1',bound:'O',service_type:'1',seq:2,stop:other},
  {route:'1',bound:'I',service_type:'1',seq:1,stop:other},
  {route:'1',bound:'I',service_type:'1',seq:2,stop}
 ]}}));
 await page.goto('/');await page.locator('nav [data-page=nearby]').click();
 await page.locator('#stop-query').fill('1');await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('#service-choices button')).toHaveCount(2);
 await page.getByRole('button',{name:/1 → Harbour/}).click();
 await expect(page.locator('#results .stop-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Change direction',exact:true}).click();
 await page.getByRole('button',{name:/1 → Campus/}).click();
 await page.getByRole('button',{name:'Choose this stop →',exact:true}).click();
 await page.getByRole('button',{name:'Save commute',exact:true}).click();
 await expect(page.locator('#advice')).toContainText('Leave in');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bus-o-clock.favourites.v1')).favourites[0]);
 expect(saved).toMatchObject({stopId:stop,route:'1',direction:'O',serviceType:'1',stopSequence:1});
});
