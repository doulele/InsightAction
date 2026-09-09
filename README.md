# InsightAction · 观止知行

> 观止知行 · 数字修行。帮你从信息洪流中提取重点，把认知转化为行动，戒断无效刷屏，回归有序生活。

基于 **uni-app (Vue 3) + TypeScript + Vite + Pinia** 的微信小程序（CLI 工程，VSCode 开发，微信开发者工具预览）。

完整功能清单与讨论存档见本地文件 `docs/观止知行-功能清单.md`（已被 git 忽略，不入库）。

---

## 快速开始

```bash
npm install            # 安装依赖
npm run dev:mp-weixin  # 开发模式（watch，输出 dist/dev/mp-weixin）
```

然后打开 **微信开发者工具** → 导入项目 → 选择 `dist/dev/mp-weixin` 目录。
`src/manifest.json` 中 `mp-weixin.appid` 默认为 `touristappid`（游客模式可直接预览），**发布前替换为你的真实 AppID**。

| 命令 | 说明 |
| --- | --- |
| `npm run dev:mp-weixin` | 微信小程序开发（watch） |
| `npm run build:mp-weixin` | 微信小程序生产构建 |
| `npm run dev:h5` | H5 调试 |
| `npm run type-check` | TS 全量类型检查（vue-tsc） |

## 产品形态与页面结构

小程序以「观止知行」为唯一核心产品，**5 Tab 大厅**（观 / 止 / 知 / 行 / 我）+ 首次引导流程。

```
src/
├─ pages/observe/index.vue    Tab0 观 · 信息大厅（启动默认页/主界面）
├─ pages/pause/index.vue      Tab1 止 · 静修大厅
├─ pages/reflect/index.vue    Tab2 知 · 悟道大厅
├─ pages/action/index.vue     Tab3 行 · 行动大厅
├─ pages/me/index.vue         Tab4 我 · 修行看板
├─ pages/entry/startup.vue    首次引导 · 启动箴言页（自定义导航）
├─ pages/entry/mode-select.vue 首次引导 · 三模式选择
│
├─ config/                   brand 品牌 / modes 三模式元数据 / lexicon 词表 / env
├─ api/                      http 泛型请求层、mock 层、按业务拆分的模块接口
├─ stores/                   pinia：app 引导标记 / mode 模式 / daily 每日修行…
├─ router/routes.ts          路由总表 + 类型化跳转（tab 自动 switchTab）
├─ types/                    与后端约定的通信类型（ApiResult / 分页 / BizError）
├─ utils/                    存储封装、平台判定
├─ components/               easycom 组件（BrandSeal / EntryItem）
└─ uni.scss                  设计令牌（纸墨配色全局变量）
```

## 架构规则

1. **tabBar 大厅页必须留在主包** —— 每个大厅只做「轻壳」（状态栏 / 列表 / 跳转），控制主包 ≤2MB；
2. **功能子页全部按区分包**（`subpkg-observe/pause/reflect/action/me/common`），子页一建即落分包；
3. **三模式是"皮肤"不是"逻辑"**：修行数据只有一份；模式只改变叫法与文案 —— 元数据在 `config/modes.ts`，词表（状态栏等差异文案）在 `config/lexicon.ts`，未来加模式 = 各加一行；
4. **启动分流**：`App.vue` onLaunch 检测 `app.onboarded` —— 未完成引导 → 启动箴言 → 选模式；已完成 → 直接进观大厅；
5. **一切跳转走 `router/routes.ts`**：`navigateTo(ROUTES.xxx)` 自动区分 switchTab / navigateTo，杜绝魔法字符串。

## 三模式

| | 普通 🌿 | 科技 🔬 | 修仙 🐉 |
| --- | --- | --- | --- |
| 测评 | 生活基线 | 数字画像 | 灵根检测 |
| 成长 | 阶位 | 段位 | 境界 |
| 社交 | 伙伴 | 搭档 | 道侣 |
| 小枢 | 温和助手 | 数据分析师 | 护法灵兽 |

三模式已可整体切换词表文案与主题化视觉（模式切换不清数据，见批次 D / m7）。

## 开发批次路线（前端全部完成 → 进入后端）

- **批次 A（已完成）**：5 Tab 形态 + 首次流程（启动箴言 → 选模式）+ 三模式/词表基建 + 五大厅第一版样貌
- **批次 B（已完成）**：观/止子页分包化 —— 稍后读、禅定沙漏（真实计时入账）、专注统计、静心茶室（五盏沉浸）、定时入定、每日定力目标 · 连胜
- **批次 C（已完成）**：知/行/我子页 + 首次测评 —— 灵魂拷问、知识卡片流/知识库、认知成长曲线；习惯打卡、微行动盲盒、行动周报；测评建档、成就墙、活跃日历、痕迹时间轴
- **批次 D（已完成）**：小枢全局浮层（三模式形态）+ 到点激励（早/晚窗、入定到点、断连守护）+ 模式主题化 + 设置 + 今日日课卡（转发/复制）
- **m7（已完成）**：小枢羁绊（对话录 · 箴言墙 · 羁绊 Lv.1-20）、止·触发干预卡片（1-3 分钟呼吸暂停）、行·愿望清单（修为兑换现实奖励）
- **之后 → 后端 Node（阿里云）联调**：接口统一走 `api/` 分发层，mock 自动退场。剩余功能逐项见 `docs/观止知行-功能清单.md` 末尾「开发台账」（登录云同步 / AI service / 道侣系统 / 身体电量 / 截图分析 / 进阶视觉 / 前端小项 / 真机能力验证）

## 基建说明（含 TS 练习点）

| 模块 | 说明 | 值得阅读的类型写法 |
| --- | --- | --- |
| `config/modes.ts` | 三模式元数据 | `readonly` 元组 + 模式联合类型 `ModeId` |
| `config/lexicon.ts` | 三模式状态栏词表 | `Record<HallId, Record<ModeId, Formatter>>` |
| `api/http.ts` | 泛型请求层：统一外壳、BizError、401 钩子、mock 分发 | 泛型 `<T, D>`、类型收窄 |
| `api/mock.ts` | 可插拔 mock：后端就绪填 `VITE_API_BASE_URL` 即退场 | Promise 返回与联合类型 |
| `stores/index.ts` | Pinia 自动持久化插件 | `declare module` 接口扩展 |
| `stores/*.ts` | setup store + persist | store 与业务编排 |
| `router/routes.ts` | 路由总表 | `as const` → `RoutePath` 联合 |
| `utils/storage.ts` | 泛型存储 | 泛型 + 收窄 |

## 与未来 Node 后端的数据约定

```
响应外壳：{ code: 0, message: 'ok', data: T }   // code===0 成功
分页数据：data: { list, total, page, pageSize }
异常：    code!==0 前端抛 BizError；401（ApiCode.Unauthorized）已留统一钩子
```

## 已知约束与规划

- **主体为个人小程序**：`web-view` 不可用；无「社交/游戏」类目可选 → 不设公开内容广场，道侣仅 1v1 熟人绑定；
- **不承载"游戏"内容**（微信将小游戏列为独立品类，个人主体无游戏类目）；"好玩/轻量"统一以工具化练习落地（呼吸陪伴 / 专注计时 / 屏离挑战）；
- **每日定时推送不可行**：订阅消息为一次性授权 → 改为 App 内到点激励（小枢执行），订阅消息仅保留给低频强事件；
- **AI 收敛**：统一收敛到单一 `ai` service，仅登录/管理员可用（登录体系接入在后端阶段）；
- `src/manifest.json`：替换真实 AppID、按需补充隐私协议配置。
