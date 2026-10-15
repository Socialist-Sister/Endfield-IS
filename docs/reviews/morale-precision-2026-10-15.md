# 心情消耗精度修正

用户反馈：莱万汀、卡缪、余烬的制造舱 A 班排 17 小时，网站没有疲劳提示，但游戏提醒工时不足；改成 16 小时没有提醒。此前“完整名单无疲劳”的结论仅在错误的 7% 消耗常量下成立，不可视为游戏验证。

## 数据来源与复算

公开游戏数据仓库 UPON-2021/EndFieldData，固定提交 `a1df392f03760e28a1d4c3e80bba9d1b5cef0f9e`：

- [SpaceshipConst.json](https://github.com/UPON-2021/EndFieldData/blob/a1df392f03760e28a1d4c3e80bba9d1b5cef0f9e/TableCfg/SpaceshipConst.json)：`basePhysicalStrengthCostRate = 12`、`basePhysicalStrengthRecoveryRate = 20`、`maxPhysicalStrength = 10000`。
- [SpaceshipRoomAttrTypeTable.json](https://github.com/UPON-2021/EndFieldData/blob/a1df392f03760e28a1d4c3e80bba9d1b5cef0f9e/TableCfg/SpaceshipRoomAttrTypeTable.json)：消耗与恢复属性的 `showRate = 0.6`。
- [SpaceshipUtils.lua](https://github.com/UPON-2021/EndFieldData/blob/a1df392f03760e28a1d4c3e80bba9d1b5cef0f9e/LuaScripts/Common/Utils/SpaceshipUtils.lua)：消耗技能按舱室基础消耗乘算，并将同类技能贡献相加。
- [莱万汀后勤技能](https://warfarin.wiki/cn/operators/laevatain)：E4 制造舱全舱心情消耗降低 18%。

公开快照不等于当前客户端全部规则，但上述精度与用户的 16/17 小时边界、此前游戏截图无减耗的 13 小时 53 分预计工时一致。

基础消耗为 `12 × 0.6 = 7.2%/小时`，恢复仍为 `20 × 0.6 = 12%/小时`。满心情统一归一为 100：

- 无减耗：`100 / 7.2 = 13 小时 53 分 20 秒`。
- 18% 减耗：`100 / (7.2 × 0.82) = 16 小时 56 分 15.61 秒`。
- 17 小时班次比满心情续航长约 3 分 44 秒；16 小时班次结束余 5.536% 心情。

错误来源是将整数界面口径 7% 直接当作计算常量，而不是减耗技能只对本人有效。旧值给出 17 小时 25 分左右的错误续航，足以导致整点排班跨过真实上限。

## 修复范围

统一模拟器、旧单班基线、旧倒班模拟器和自动分配启发式均使用 7.2%，不单独把某个阵容限制为 16 小时。更新独立解析验证（无减耗长期工作比例从 12/19 修正为 5/8），保留精度来源和真实阵容 17/16 边界测试。旧历史报告保留，当前说明改为 7.2%。

## 验证结果

- 109 项测试与生产构建通过；真实截图阵容的 17 小时疲劳时长与独立公式一致，16 小时无疲劳。
- 浏览器全选 E4 重新计算：制造舱Ⅰ/Ⅱ均为 16/8 小时，培养舱为 13/11 小时，总控 12/12，会客 20/4；无班内疲劳提示。
- 手动将仅莱万汀的制造舱安排为 17 小时，页面明确显示续航不足。该场景同时有休息不足，因此疲劳时长不等于有足够总控恢复的原截图阵容。
- 浏览器无错误、无坏图。旧报告的无疲劳结论已标记过时，未将数学回归通过等同于完整游戏实测。

用户已明确授权推送上线；通过 GitHub main 触发现有 EdgeOne / Vercel 部署，不创建编号 Release。
