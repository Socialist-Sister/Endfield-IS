<div align="center">

# Endfield-IS

**《明日方舟：终末地》帝江号基建排班计算器**

根据干员、练度、生产配方与上线时间，计算长期挂机或定点换班的排班方案与预计日产量。

[简体中文](README.md) · [English](README.en.md)

[![Live App](https://img.shields.io/badge/Live%20App-EdgeOne-FFEF3A?style=flat-square&labelColor=171918)](https://www.endfieldis.dpdns.org/)
[![Vercel](https://img.shields.io/badge/Fallback-Vercel-171918?style=flat-square&logo=vercel&logoColor=white)](https://endfield-is.vercel.app/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=171918)](https://react.dev/)
[![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Operators](https://img.shields.io/badge/Operators-30-F5DD26?style=flat-square&labelColor=171918)](#核心能力)

<kbd>AFK Solver</kbd> <kbd>Fixed Rotation</kbd> <kbd>Morale Simulation</kbd> <kbd>Production Estimate</kbd>

</div>

---

> Endfield-IS 是一个面向帝江号基建的非官方计算工具。玩家手动填写持有干员、练度、生产目标和上线时间；项目不会读取、识别或操作游戏客户端。

## 目录

1. [在线使用](#在线使用)
2. [界面预览](#界面预览)
3. [核心能力](#核心能力)
4. [排班模式](#排班模式)
5. [计算模型](#计算模型)
6. [本地开发与测试](#本地开发与测试)
7. [部署](#部署)
8. [数据与素材](#数据与素材)

---

## 在线使用

| 站点 | 用途 | 地址 |
|---|---|---|
| EdgeOne Makers | 面向大陆网络的主部署 | [打开计算器](https://www.endfieldis.dpdns.org/) |
| Vercel | 海外与备用部署 | [打开计算器](https://endfield-is.vercel.app/) |

### 使用流程

1. 选择排班模式：**长期挂机**或**定点换班**。
2. 设置两个制造舱的固定配方、培养材料类别，以及对应的排班参数。
3. 勾选已拥有干员并调整 E0–E4 练度；所有干员默认 E4，但初始均不勾选。
4. 开始计算，查看逐舱排班、启动时间、技能生效状态和预计日产量。
5. 复制当前配置链接，或将计算结果导出为带主站地址的排班图。

---

## 界面预览

<div align="center">
  <img src="docs/images/interface-config.png" alt="配置页面" width="49%" />
  <img src="docs/images/interface-result.png" alt="结果页面" width="49%" />
</div>

界面以终末地官网为主要视觉参考，使用黑、雾白与信号黄构成适合计算工具的信息层级，并适配桌面与窄屏窗口。

以上预览来自 `v0.1.2` 当前界面。

---

## 核心能力

- **30 名可排班干员**：排除暂无可靠基建数据的两种管理员形态；没有匹配技能的干员仍可作为通用进驻人员参与计算。
- **练度驱动技能**：逐名设置 E0–E4，自动控制最多两个基建技能的解锁和升级。结果页同时展示两个技能槽，未解锁或不生效技能会保留并置灰。
- **逐舱生产目标**：制造舱Ⅰ、制造舱Ⅱ分别固定选择高级认知载体、高级作战记录或武器检查套组；培养舱Ⅰ固定选择矿物、晶植或菌类类别。
- **跨设施唯一分配**：统一计算总控中枢、会客室、制造舱Ⅰ、制造舱Ⅱ和培养舱Ⅰ，避免同一干员在同一时间被重复安排。
- **连续心情模拟**：模拟工作消耗、总控恢复、技能修正、自动下班与满心返岗；定点换班不会把复用干员重置为满心情。
- **真实产量目标**：以稳定周期的实际日产量优化方案，允许在收益更高时出现短暂停工，而不是把 100% 覆盖率设为硬约束。
- **非阻塞计算**：长时间搜索在 Web Worker 中运行，并用贴底进度条显示进度。
- **纯前端分享**：配置压缩到 URL 哈希中，不上传账号数据；结果页可直接生成适合社区发布的排班图。

---

## 排班模式

### 长期挂机

模拟帝江号自动上下班：干员心情耗尽后离岗，恢复至满心情后重新上岗。算法以 30 分钟为步长搜索实际启动偏移，在长时间预热后比较稳定周期日产量。

| 搜索范围 | 说明 |
|---|---|
| 统一启动轴 | 所有设施共用一组启动时间，执行成本更低 |
| 分设施启动轴 | 各设施独立搜索；只有验证日产量高于统一方案时才采用 |

### 定点换班

用户填写每天上线时间，每个时间点执行完整班组替换。模拟会跨班次、跨天连续追踪每名干员的心情；只有在长期产量更高时，才允许复用人员或接受设施停工。

---

## 计算模型

| 项目 | 当前口径 |
|---|---|
| 工作心情消耗 | `7% / 小时` |
| 总控中枢恢复 | 基础 `12% / 小时`，再乘算生效的恢复技能修正 |
| 制造 / 培养 / 会客效率 | `(1 + 40% × 在岗人数) × (1 + 匹配技能总和)` |
| 通用进驻加成 | 没有匹配设施技能的干员仍提供每人 40% 加成 |
| 制造时长 | 高级认知载体 `24:26:40`；高级作战记录、武器检查套组 `09:46:40` |
| 培养对象 | 整次模拟固定为矿物、晶植或菌类中的一个类别 |
| 特定线索技能 | 仅保留 L1 / L2 定性倾向；同类效果不叠加，不虚构固定每日线索数 |

制造舱各自保持所选配方不变；两个舱选择相同配方时合并日产量。总控中枢以外的挂机设施不会混用心情消耗降低干员与普通干员，避免排班周期错位。

> 计算结果是基于当前公开数据和模型的估算，不代表游戏内实时状态。游戏数值或机制变化后，需要同步更新干员数据与计算口径。

---

## 本地开发与测试

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

生产构建与测试：

```bash
npm run build
node --test tests/schedule-model.test.mjs
node --test tests/share-tools.test.mjs
npm run test:sites
```

浏览器资源输出到 `dist/client`；构建脚本还会生成 Sites 交付所需的 `dist/server/index.js` 和 `dist/.openai/hosting.json`。

测试覆盖稳定周期启动轴、连续心情追踪、跨设施唯一分配、固定材料类别、逐舱配方与时长换算、同配方产量合并和线索估算等关键行为。

### 技术栈

React 19 · Vite 6 · Phosphor Icons · Web Worker · Node.js 原生测试运行器

---

## 部署

两个站点均连接本仓库的 `main` 分支并自动构建发布。

| 平台 | 安装命令 | 构建命令 | 输出目录 |
|---|---|---|---|
| EdgeOne Makers | `npm install` | `npm run build` | `dist/client` |
| Vercel | `npm install` | `npm run build` | `dist/client` |

Vercel 的路由与构建设置见 [`vercel.json`](vercel.json)。
搜索与社交分享统一以 EdgeOne 自定义域名作为 canonical 主站，Vercel 保留为备用访问入口。

---

## 数据与素材

干员头像以本地静态资源随项目发布，避免运行时依赖第三方图片服务。头像对应关系参考了 [MR-LORD-REX/endfield-builds](https://github.com/MR-LORD-REX/endfield-builds) 的公开映射。

《明日方舟：终末地》及其角色、美术与相关素材版权归 Hypergryph / GRYPHLINE 所有。本项目为非官方工具，不主张对相关游戏素材拥有权利。

欢迎通过 [Issues](https://github.com/Socialist-Sister/Endfield-IS/issues) 提交数据纠错、算法问题或界面建议。
