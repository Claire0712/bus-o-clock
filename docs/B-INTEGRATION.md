# B → A 接口交接：Bus o'Clock

## 接入位置

B 的所有运行代码在 `packages/data`，不依赖 React/Vue，不修改 A 的页面或根目录工具链。
合并 `feat/data-location` 后，在 A 已有的前端项目目录运行（路径按项目位置调整）：

```sh
npm install ./packages/data
```

```js
import { createBusOClock } from '@bus-o-clock/data';
// 保持单例，复用静态目录缓存。
const bus = createBusOClock();
```

原生 JS 页面可直接使用 ES module：`import { createBusOClock } from './packages/data/src/index.js'`。
必须通过 HTTP localhost 或 HTTPS 加载，不用 file://。TypeScript 类型在包内 `index.d.ts`。

## 1. 定位 → 附近站点 → 线路

```js
// 在用户点击定位按钮后调用；不要在组件每次 render 时请求权限。
const result = await bus.getNearbyStops({ radiusMeters: 1000, limit: 20 });
// result = { location, locationSource: 'device', stops }
// stop = { id, name: { en, tc, sc }, latitude, longitude, distanceMeters }
// device location 还包含 accuracyMeters、timestamp。
const routes = await bus.getRoutesForStop(result.stops[0].id);
// route = { stopId, route, direction, serviceType, stopSequence, origin, destination }
```

先判断 `result.stops.length`，为空时显示“1 km 内没有九巴站点”。距离是直线距离，不能写成步行距离；精度差时显示 `accuracyMeters` 提示。
拒绝定位后，A 可以让用户点地图，并传入手动坐标：

```js
const result = await bus.getNearbyStops({
  point: { latitude: 22.345415, longitude: 114.192640 },
  radiusMeters: 1000,
  limit: 10
});
// 上面只是公开站点的示例坐标，不能冒充用户位置。返回 locationSource: 'manual'。
```

`direction` 是 `O` / `I`，不是 UI 翻译文本；`serviceType` 是字符串；`stopSequence` 是数字。
**保存用户选中的完整 route 对象内的这三个字段**，不要只保存线路号。相同站点可能出现两个方向，也可能在循环线路里出现两次。
`origin` / `destination` 都是 `{ en, tc, sc }`，UI 推荐用目的地文本帮助选方向。
线路末站的到达班次不会作为可上车选项返回；若此站只下客，线路列表可能为空。

## 2. 出门建议

```js
const commute = {
  ...routes[0], // 实际使用用户选中的线路
  walkMinutes: 4,
  bufferMinutes: 2
};

const stopWatching = bus.watchCommute(commute, state => {
  // React: setState(state); Vue: stateRef.value = state
  console.log(state.status, state.leaveInSeconds, state.recommended);
});
// 组件卸载、切换通勤或进入后台时必须调用：
stopWatching();
```

网络刷新间隔为上一次请求完成后 60 秒，不并发刷新；每秒重新计算倒计时和数据新鲜度。
`walkMinutes` / `bufferMinutes` 更改时，先停止旧 watcher，再使用新配置启动。
每个 watcher 建立时会立即请求一次；编辑设置建议在确认/失焦后重新启动，避免每按一个数字就请求接口。
前台恢复时重新创建 watcher，避免 Android 后台计时暂停导致误导。
也可只获取一次：`await bus.getCommute(commute)`，但单次结果不会自动变旧，UI 必须自行刷新。

| state.status | UI 建议 |
| --- | --- |
| loading | 加载中 |
| wait | 建议 X 分 Y 秒内出门 |
| leave-now | 建议现在出门（剩余不超过 60 秒） |
| too-late | 已展示的班次不足以覆盖步行和缓冲时间，等待后续班次 |
| no-service | 暂无预计到站时间；显示运营方备注，不直接断言停运 |
| stale | 数据已过期或时间戳不可信，暂不建议出门 |
| error | 请求失败，允许重试，显示 `state.error.message` |

核心字段：

- `recommended`：推荐班次；不可推荐时为 `null`。
- `leaveInSeconds`：推荐班次的出门倒计时；不可推荐时为 `null`，不可把 null 渲染为 0。
- `departures`：所选方向/服务/站序的有效未来班次，按到站时间排序；包含赶不上的班次。
- `departure.catchable`：到站时间能否覆盖“步行＋缓冲”，不是保证能赶上。
- `departure.scheduled`：运营方标记为原定班次，应在 UI 标识“计划班次”。
- `departure.eta` / `leaveAt`：ISO 时间；用 `Intl.DateTimeFormat` 加 `timeZone: 'Asia/Hong_Kong'` 展示香港时间。
- `generatedAt`：响应生成时间；`updatedAt`：相关有效行中最旧的数据时间；`evaluatedAt`：本次计算时间。
- `staleCount`：丢弃的过期相关行数量；可提示“部分班次数据过期”。
- `remarks`：运营方备注数组；即使无 ETA，也应显示可用备注。
- `refreshing`：后台刷新中。刷新失败时清除旧建议，下一轮成功后恢复。

公式：`leaveAt = ETA - walkMinutes - bufferMinutes`。选第一个 `leaveAt >= 当前时间` 的班次；若第一班太近，自动跳到下一班。
来源生成时间及每行数据时间均需在 120 秒内；比设备时间超前超过 60 秒也不推荐。120 秒是本项目策略，不是九巴精度保证。

## 3. 收藏

```js
const saved = bus.favourites.save({ ...commute, label: '去学校' });
const { status, favourites } = bus.favourites.load();
bus.favourites.remove(saved.id);
```

相同站点＋线路＋方向＋服务类型＋站序再次保存，会更新原记录。改变这五个身份字段时是另一条收藏。
收藏只存本机 localStorage，不上传用户位置。清除站点/App 数据或更换设备后不保留，不提供账户同步。
`load()` 返回 `ok` / `corrupt` / `unavailable`。写入失败会抛 `STORAGE_UNAVAILABLE`；损坏数据不会被悄悄覆盖。
保存后 UI 只有在 `save()` 成功返回时才能显示“已保存”。

## 4. 错误码

Promise 操作请使用 try/catch。错误是带 `.code` 的 `DataError`。

- `LOCATION_DENIED`：用户拒绝定位，提供手动选点。
- `LOCATION_TIMEOUT` / `LOCATION_UNAVAILABLE`：重试或手动选点。
- `HTTP_ERROR` / `NETWORK_ERROR` / `TIMEOUT` / `INVALID_RESPONSE`：API 错误，不伪造 ETA。
- `ABORTED`：用户已离开页面，可忽略。
- `INVALID_INPUT`：检查方向、站序和时长。
- `STORAGE_CORRUPT` / `STORAGE_UNAVAILABLE`：收藏未保存成功。

静态站点、线路及关联目录在内存中缓存一小时，ETA 不在模块中缓存。首次下载目录需要网络；本 MVP 不包含离线站点地图。
支持 `AbortSignal` 的操作：`getNearbyStops`、`getRoutesForStop`、`getCommute` 和 client 请求。
浏览器的定位授权弹窗无法由 AbortSignal 关闭，但查询会立即以 ABORTED 拒绝；晚到的定位结果不会触发站点下载。

## 5. React 生命周期示例

```jsx
// bus 在模块级创建，commute 应是稳定对象（例如 useMemo 或 state）。
useEffect(() => {
  if (!commute) return;
  let stop = () => {};
  function syncVisibility() {
    stop();
    if (!document.hidden) stop = bus.watchCommute(commute, setAdvice);
  }
  syncVisibility();
  document.addEventListener('visibilitychange', syncVisibility);
  return () => {
    stop();
    document.removeEventListener('visibilitychange', syncVisibility);
  };
}, [commute]);
```

React 开发模式重复挂载时旧 watcher 会被 cleanup 终止，晚到请求不会写回旧状态。

## 6. Android 接入条件

现已在仓库根目录接入实时前端，并提供 Capacitor Android 工程。构建命令见 README，联调结果见 APP-VERIFICATION.md。原生适配器已接入；模拟器测试不等于真机定位精度测试。
若选择 Capacitor，各包使用相互兼容的主版本，按[官方 Android 文档](https://capacitorjs.com/docs/android)建立工程。

```js
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { createBusOClock, createCapacitorLocationProvider } from '@bus-o-clock/data';
const bus = createBusOClock(Capacitor.isNativePlatform()
  ? { locationProvider: createCapacitorLocationProvider(Geolocation) }
  : {});
```

按[定位插件文档](https://capacitorjs.com/docs/apis/geolocation)在 AndroidManifest.xml 声明 coarse 和 fine location 权限，并同步插件。
插件适配器会接受 approximate/coarse 授权，并保留精度信息；地图上应提示精度较低。
不要把 `navigator.geolocation` 在桌面上的成功当成 Android 权限已验证。
最终联调需检查：允许定位、拒绝定位、近似定位、飞行模式、切后台后回来、收藏重启恢复、无服务班次。

## 7. 验证命令

仓库根目录执行：

```sh
node --test packages/data/test/*.test.js
node packages/data/scripts/live-smoke.js
python3 -m http.server 8765 --bind 127.0.0.1
```

最后一条用于打开 `http://127.0.0.1:8765/packages/data/examples/diagnostic.html`。
诊断页用于联调数据，不是 A 的正式 UI；先点 Load example location 就能使用公开示例位置验证真实接口。
测试不会上传用户位置。实时检查允许返回 `no-service` 或 `stale`，因为服务时间和数据新鲜度由运营方决定。

## 数据来源

- [DATA.GOV.HK 九巴/龙运到站数据](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)
- [KMB API Specification v1.05](https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf)

UI 应保留数据来源和估算说明。数据的使用受来源方条款约束。本模块没有付费 API 或 API key。
