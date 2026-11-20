# B 最终核验与交接清单

核验基线：`48bfac6a013bfa20ac15055689a77799fe63c46c`，已包含组员最新 UI 与定位修改。

## 真实接口核验

以下是实际 API 请求；公开站点坐标，不含个人位置。原始响应、响应生成时间、
每行更新时间、完整服务标识与计算结果见 [JSON 证据](../../evidence/member-b-2026-11-19/data-verification.json)。
原始 ETA 行可能包含不同方向，过滤后的班次数量少于原始行数是正常现象。
这些请求证明查询时接口与程序的连接和计算一致，不等于现场观测公交实际到站准确率。

| 线路 | 站点 | Stop ID | 方向 / 服务 / 站序 | 香港查询时间 | 原始行 / 有效未来班次 | 状态 / 出门倒计时 |
|---|---|---|---|---|---|---|
| 1 | CHUK YUEN ESTATE BUS TERMINUS | 18492910339410B1 | O / 1 / 1 | 2026-11-19T14:29:45.521000+08:00 | 6 / 2 | wait / 314 秒 |
| 1A | SAU MAU PING (CENTRAL) | A3ADFCDF8487ADB9 | O / 1 / 1 | 2026-11-19T14:29:45.579000+08:00 | 6 / 3 | wait / 374 秒 |
| 2 | STAR FERRY, HARBOUR CITY | 5E2EC7476D55E0BA | O / 1 / 1 | 2026-11-19T14:29:45.650000+08:00 | 3 / 3 | wait / 554 秒 |

## 计算核验（合成固定时钟，非实时观测）

| 场景 | 预期 | 实际 |
|---|---|---|
| ETA 10 分钟，步行 4 分钟，缓冲 2 分钟 | 240 秒，wait | 通过 |
| 第一班 3 分钟、下一班 14 分钟，步行＋缓冲 6 分钟 | 选下一班，480 秒 | 通过 |
| ETA = null | no-service，无倒计时 | 通过 |
| 响应已过去 121 秒 | stale，无倒计时 | 通过 |

## 自动验证

- 35 项数据测试通过：见 unit-tests.txt。
- 3 组浏览器联调测试通过：见 browser-tests.txt（模拟 API，独立于上述真实检查）。
- Vite 生产构建通过：见 build.txt。
- npm audit 本次返回 0 项已知漏洞：见 dependency-audit.json；依赖版本见 dependencies.json。
- 历史的“4 high”提示未在本次检查复现，不能据此倒推历史提示错误；没有盲目运行强制升级。

以上记录均位于 `evidence/member-b-2026-11-19/`。测试与 audit 是时间点证据。

## 给组员的交接

- B：数据、计算、接口异常处理与本次验证资料已完成；准备讲解本目录的 3 页 PPT 文案。
- 界面负责人：已同步你们现有界面，B 本轮没有改动 UI。
- 组员 3：按当前源代码重新打包并做实体 Android 手机测试；旧 Release APK 不包含后续界面修改。
- 组员 4：补真实用户反馈、真实设备拒绝定位/断网/后台恢复测试，不用把单元测试称为用户测试。
- 组员 5：整合 REPORT-SECTION.md、PPT-CONTENT-AND-SCRIPT.md，以及真实成员姓名和贡献。
- PR #1 目前仍打开：代码及资料上传后由团队审阅合并；这轮不擅自代替组员确认最终版本。
- 统一截止：2026-11-23 08:30 香港时间；源码＋最终 APK ZIP、PPT、小组 PDF 报告及贡献名单均需提交。

## B 贡献说明草稿（按实际工作确认后使用）

Member B worked on the KMB data integration and departure-advice logic, including
service identity, freshness/error handling and validation. The verification package
includes live checks for routes 1, 1A and 2, deterministic calculation cases, test
logs and technical material for the group report and presentation. Interface
revisions and physical-phone validation should be attributed to the members who
actually completed them.
