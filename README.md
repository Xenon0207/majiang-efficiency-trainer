# 牌理小课

**在线体验：[https://xenon0207.github.io/majiang-efficiency-trainer/](https://xenon0207.github.io/majiang-efficiency-trainer/)**

面向日麻初学者的渐进式牌效练习。首页先提供面向川麻/国标玩家的 12 课日麻规则入门：15 分钟学会合法和牌，30 分钟掌握六个常用役，第一次遇到立直后开始学习防守；重点规则通过 58 道场景题反复练习。1.0 收录 14 个基础原则、每课 6 道静态题，共 84 题；每题只切一次牌。2.0 提供从散牌开始的连续摸切训练，同时评价普通手、七对子和国士路线。两个版本都保留可交互分组辅助。

## 本地运行

```bash
pnpm install
pnpm dev
```

测试与生产构建：

```bash
pnpm test
pnpm build
```

1.0 题库由版本化离线生成器产生，生成参数包含数牌花色置换、数字镜像、风牌身份轮换、箭牌轮换和课程专用场景模板。2.0 连续训练在浏览器内即时洗出完整合法牌山，起手、宝牌指示物与后续进张全部随机，向听、受入、次巡期望和好型均实时计算；不调用在线 AI。修改 1.0 种子题或离线回归会话后运行：

```bash
pnpm generate
```

也可以分别运行 `pnpm generate:1.0` 或 `pnpm generate:2.0`。

题库测试会验证牌张合法性、向听数、答案、合理候选数量、赤五、花色顺序、随机完整牌山和分组规则。当前“合理候选”的暂定边界集中在 `src/content/config.ts`，等待真人试玩后再校准。

答案分割由实际牌张生成，按玩家当前手牌排列显示，并使用日麻常见字牌写法 `東・南・西・北・白・發・中`；例如 `[1p] [456p] [2m] [68m] [05s] [789s] [東]`。

## 内容与授权

- 课程原则以《魔女BLOG初中级日麻讲座》为知识来源，题目和中文解释为本项目重新编写，不收录原 PDF。
- 牌面来自 [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)，使用 CC0 授权；网页统一使用其 Regular PNG 导出并叠加浅色牌框，避免旧 SVG 在部分浏览器中解析失败。授权副本见 `public/tiles/LICENSE.md`。

推送到 `main` 后，仓库内工作流会自动测试、构建并部署到 GitHub Pages。首次使用时需在仓库 Settings → Pages 中把 Source 设为 GitHub Actions。
