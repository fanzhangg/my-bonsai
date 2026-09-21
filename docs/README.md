# 文档导航 · Documentation

当前产品设计：[简体中文](design.zh-CN.md) · [English](design.en.md)。启动、CI 和部署入口见 [项目 README](../README.md)。

[实现与开发参考](implementation-notes.zh-CN.md) 汇总历次功能记录；其中的阶段描述可能已被后续方案替代。

文档按用途分目录，文件名使用英文 `kebab-case`，中文文档使用 `.zh-CN.md`，英文文档使用 `.en.md`。正文保留原语言。历史文档中的“当前”“待审核”“未推送”均指记录当时，不代表今天的发布状态。

## 实现参考 · implementation

功能行为、版本接入和性能记录。

- [新版盆栽设计系统应用接入方案](implementation/design-system-integration.zh-CN.md)
- [手机浇水、剪枝与 Gallery 性能优化](implementation/mobile-performance.zh-CN.md)
- [剪枝交互](implementation/pruning-interaction.zh-CN.md)
- [随机认养盆器](implementation/random-pots.zh-CN.md)
- [v3 剪枝、生长与作弊模式集成](implementation/v3-pruning-growth.zh-CN.md)
- [天气与时间背景](implementation/weather-background.zh-CN.md)
- [盆栽动漫式风动](implementation/wind-animation.zh-CN.md)

## 设计原则 · design

树形、配色与 UI 的专题设计；各文档内的阶段状态仍需结合当前实现阅读。

- [盆栽生成设计系统](design/bonsai-generation.zh-CN.md)
- [固定层次色组 · 已认可的配色方向](design/layered-color-palette.zh-CN.md)
- [主干剪影：盆景造型原型](design/trunk-silhouette.zh-CN.md)
- [UI 颜色设计系统](design/ui-colors.zh-CN.md)
- [一盆树 · UI 设计系统 v0.2](design/ui-system.zh-CN.md)

## 研究与原型 · research

候选方案与实验，不等同于主游戏已上线功能。

- [盆景形态研究与改进](research/bonsai-morphology.zh-CN.md)
- [树冠算法改进方案 · 待审阅](research/crown-algorithm.zh-CN.md)
- [修叶玩法 · 本轮实现](research/leaf-trimming.zh-CN.md)
- [手机端枝干造型调整方案](research/mobile-branch-design.zh-CN.md)
- [剪枝驱动的状态式生长实现方案](research/stateful-growth.zh-CN.md)

## 验收记录 · reviews

特定阶段的交互检查与原型审核。

- [修叶体验审核与改进](reviews/leaf-trimming.zh-CN.md)
- [手机触屏交互审核](reviews/mobile-touch.zh-CN.md)
- [状态式生长原型审核说明](reviews/stateful-growth.zh-CN.md)

## 历史归档 · archive

早期 MVP、旧版算法及已撤回的视觉实验，仅用于追溯设计决策。

- [侧枝生长模型：真柏原型](archive/branch-growth-experiment.zh-CN.md)
- [盆栽生长算法研究与 MVP](archive/bud-growth-mvp.zh-CN.md)
- [盆景算法当前实现](archive/canopy-study-implementation.zh-CN.md)
- [树冠色彩风格再设计 · 研究与审阅方案](archive/crown-color-experiment.zh-CN.md)
- [树冠多维色彩系统 · 设计提案](archive/crown-multidimensional-colors.zh-CN.md)
- [盆景树冠造型与模拟研究](archive/crown-simulation.zh-CN.md)
- [一盆树 · 观察版 Prototype](archive/mvp-implementation.zh-CN.md)
- [我的盆栽 · MVP 设计文档](archive/original-mvp.zh-CN.md)
- [根盘造型与原型算法](archive/root-design-experiment.zh-CN.md)
- [根盘结构研究与重建设计](archive/root-structure-experiment.zh-CN.md)
- [盆景选样与参数评审](archive/specimen-selection.zh-CN.md)
- [盆景风格化算法方案](archive/stylized-algorithm.zh-CN.md)
- [从种子到盆景：渐进生长 v2](archive/v2-gradual-growth.zh-CN.md)
- [盆景视觉方案](archive/visual-styles.zh-CN.md)

## 仓库目录与临时文件

| 路径 | 用途 |
| --- | --- |
| `prototype/` | 浏览器应用、设计系统和实验页面；现有页面路径保持稳定 |
| `prototype/core/v1/`、`v2/`、`v3/` | 按存档版本保留的算法实现，不能作为重复文件删除 |
| `tests/` | 自动化测试、浏览器检查页面及 fixtures |
| 根目录 `*.mjs` | 服务入口、存储、天气和分享等服务模块 |
| `docs/` | 产品设计、技术记录与历史归档 |
| `data/` | 本地持久化数据，默认包含 `trees.json`；不提交、不整体清空 |
| `.tmp/` | 临时截图、测试输出和一次性脚本；不提交 |
| `.npm-cache/` | 本地 npm 缓存；不提交 |
| `.worktrees/` | 并行任务工作区；不提交，通过 Git 管理 |

新的临时产物统一放在 `.tmp/`，不要混入 `data/` 或源码目录。清理旧产物前应确认所属任务已结束；补丁、工作区、数据库文件与未提交代码不能按缓存处理。
