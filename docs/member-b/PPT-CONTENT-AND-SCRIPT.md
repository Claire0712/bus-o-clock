# B 的 PPT 文案与讲稿（交组员 5 合并）

以下为 3 页可直接放入小组 PPT 的内容，不是整个小组 12 分钟演示。
建议你占约 2 分钟；若组内时间更短，合并第 2、3 页。英文用于课堂展示，
中文备注帮助理解。测试数字对应 2026-11-19 留存证据。

## Slide 1 — From KMB data to a commute

- Public KMB/LWB API: stops → routes → route–stop associations → ETA
- Preserve stop ID, route, direction, service type and stop sequence
- Cache static catalogues; refresh live arrivals
- Save commute settings locally; no private server or account required

图示可直接排成一行：
Device/manual location → Nearby stop → Boarding service → ETA → Departure advice

Speaker notes:
“My part focuses on the data layer and departure calculation. We connect public
KMB data to the application and preserve the stop, route, direction, service type
and stop sequence. This matters because the same route or stop may have different
services. Static catalogues are cached, while live arrival estimates are refreshed.
Commute settings are stored locally, so the application does not require a user account.”

中文提醒：不要把客户端数据层说成已部署的自建服务器；没有账户数据库。

## Slide 2 — When should the user leave?

**Leave in = ETA remaining − walking time − buffer**

- Normal example: **10 − 4 − 2 = 4 minutes**
- First bus in 3 min, next bus in 14 min; allowance = 6 min
- Skip the first bus; **14 − 4 − 2 = 8 minutes**
- Walking time is user-entered; straight-line distance is not walking time

Speaker notes:
“The central calculation subtracts walking time and a buffer from the expected
arrival time. For example, ten minutes until arrival, minus a four-minute walk and
a two-minute buffer, means leaving in four minutes. If the first bus is too soon,
we choose the next suitable service rather than encouraging the user to rush.
These are controlled calculation examples, not current live arrival times.”

中文提醒：两组例子是合成测试；现场实时数据变化时不要硬说等于这些数字。

## Slide 3 — Validation and honest limits

- Live checks: routes **1, 1A, 2**; direction O, service type 1, sequence 1
- **35 data tests + 3 browser integration tests passed**
- No ETA / stale data / failed request → no misleading countdown
- Report scheduled services and update timestamps
- Limits: operator estimates, walking assumptions, device clock; physical-phone QA by the Android owner

Speaker notes:
“We checked three actual routes and retained the original responses and timestamps.
We also ran thirty-five data tests and three browser integration tests. These
cover calculation, persistence and important error states. If the arrival data is
missing, stale or the request fails, the app does not keep an old countdown as if
it were current. Arrival predictions can still change, and real-phone positioning
needs the Android owner's final validation.”

## 演示步骤（约 30–45 秒，按组内总时长选用）

1. 打开 https://claire0712.github.io/bus-o-clock/ 。
2. Nearby → 公开示例位置 → 站点 → 线路/方向。
3. Walking = 4、Buffer = 2，保存。指出更新时间、计划班次标记与倒计时。
4. 若实时返回无 ETA：说明应用不编造到站时间，改展示已留存截图及合成计算表。
5. 录屏前先检查网络；不要把公开示例位置描述成自己的实时 GPS 位置。

## 常见问答

**Why no server?** The MVP consumes public endpoints directly and keeps favourites
locally; no account synchronisation is required. GitHub Pages hosts the web assets.

**How do you estimate walking time?** Users enter it. We do not treat Haversine
straight-line distance as a walkable route or travel time.

**What if the bus is late or the API fails?** The next refresh recalculates advice.
A failed request or stale timestamp suppresses the recommendation. ETA remains an estimate.

**What did B contribute?** Describe the data integration, calculation validation,
error handling and evidence you actually reviewed and can explain. Do not claim
sole authorship of other members' UI work or physical-device tests.
