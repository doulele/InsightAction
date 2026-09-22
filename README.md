# InsightAction · 观止知行

> 观止知行 · 数字修行。帮你从信息洪流中提取重点，把认知转化为行动，戒断无效刷屏，回归有序生活。

基于 **uni-app (Vue 3) + TypeScript + Vite + Pinia** 的微信小程序（CLI 工程，VSCode 开发，微信开发者工具预览）。
**个人主体**小程序：修行数据默认只存本机，需要联网的能力一律可静默降级。

> 这一份只讲"怎么跑起来、别踩什么坑"。**读代码的地图与改动导航在 `docs/观止知行-架构总览.md`**（`docs/` 被 git 忽略、不入库）。
> 功能清单 / 架构规格 / 未做事项也在同目录。

---

## 快速开始

```bash
npm install
npm run dev:mp-weixin    # watch，产物 dist/dev/mp-weixin
```

然后打开**微信开发者工具** → 导入项目 → 选择 `dist/dev/mp-weixin`。
AppID 写在 `src/manifest.json` 的 `mp-weixin.appid`（个人主体正式号，已填）；换号时前端改这一处，后端改 `.env` 的 `WX_APPID` / `WX_SECRET`。

| 命令 | 说明 |
| --- | --- |
| `npm run dev:mp-weixin` | 微信小程序开发（watch + 增量、不压缩）——**迭代调试用这个，不要拿 build 当热重载** |
| `npm run build:mp-weixin` | 微信小程序生产构建（产物 `dist/build/mp-weixin`） |
| `npm run build:mp-weixin:log` | 同上，但日志写进 `build.log`（Windows 下推荐，见下） |
| `npm run type-check` | TS 全量类型检查（`vue-tsc`，约 65 秒） |
| `npm run dev:h5` | H5 调试（少部分能力在小程序里才有，别以 H5 为准） |

> **Windows / PowerShell 注意**：跑 npm 长命令**不要**用 `| Select-Object -Last N` —— esbuild 常驻进程会让管道卡死。用 `npm run build:mp-weixin:log`，然后 `Get-Content build.log -Tail 30`。

## 后端

后端是**独立仓库**（不在本目录）：`InsightActionBacend` —— Express，端口 `3002`，路由前缀 `/guanzhi`，生产 `https://wellwin.top/guanzhi`。
接口地址按模式写在 `.env.development`（本机 3002）/ `.env.production`（线上），**唯一出口是 `src/config/env.ts`**（微信小程序开发态读不到 `import.meta.env`，所以那里有一份本机兜底常量）。

后端不可用时前端一律降级，不白屏也不报错：界面配置用内置、每日内容用预置、AI 用 `utils/localAi` 的本机规则、文件导入只留本机可解析的格式。

## 目录结构

```
src/
├─ pages/                  5 个 tabBar 大厅（只做轻壳）+ 首次引导（entry/startup、mode-select）
├─ subpkg-{observe,pause,reflect,action,me}/   功能子页一律按环分包
├─ config/                 文案 / 阈值 / 分值 / 上限 / 词表 / 色板 / schema 版本（24 个文件）
├─ stores/                 Pinia（36 个，setup store + persist）
├─ api/http.ts             统一解包 { code, message, data }、BizError、401 钩子
├─ api/modules/            按业务拆的接口（auth / app / content / skins / sync / ai / werun / parse / tts / asr）
├─ utils/                  存储、平台判定、文件、音频、语音、隐私门、周报…
├─ components/             easycom 组件（17 个，免 import）
├─ router/routes.ts        路由总表 + 类型化跳转（tab 自动 switchTab）
└─ uni.scss                设计令牌（纸墨配色）
```

## 架构规则（改代码前先看这几条）

1. **tabBar 五大厅只做轻壳**（状态栏 / 列表 / 跳转），控制主包体积；**功能子页一建即落分包**。
2. **三模式是"皮肤"不是"逻辑"**：修行数据只有一份，模式只改变叫法与样式 —— 元数据在 `config/modes.ts`，词表在 `config/lexicon.ts`。
3. **一切跳转走 `router/routes.ts`**（`navigateTo(ROUTES.xxx)`），杜绝魔法字符串。
4. **文案 / 阈值 / 分值 / 上限一律不写在页面里**，全部放 `src/config/`。
5. **三条最容易漏的连带改动**：
   - 加一个页面 = 新建子页（+ 同名 `.scss`）→ `src/pages.json` 注册 → `router/routes.ts` 加常量 → 所属大厅入口挂出来；
   - 加一个 store = `src/stores/xxx.ts` → `utils/localBackup.ts` 的 `HYDRATORS`（漏了就恢复不了）→ `utils/localReset.ts` → `config/schema.ts` 版本号 +1；
   - 加一个计分行为 = **只改 `config/trace.ts`**（`TraceKind` + `TRACE_META`，要封顶再加 `DAY_CAP`）；页面只调 `logTrace`，**永不手动 `xp.gain()`**。
6. **隐私接口一律过 `<PrivacyGate />`**（`utils/privacy.ts`）：`manifest.json` 已开 `__usePrivacyCheck__`，剪贴板 / 选文件 / 头像昵称 / 微信运动 / 麦克风在用户同意前会被微信拦下。

## 验证节奏（按触发条件走，不要每轮都跑）

| 改了什么 | 跑什么 |
| --- | --- |
| 一轮编辑进行中 | 不跑 |
| 纯 `.ts` 逻辑改动收尾 | `npm run type-check` |
| 改了 `pages.json` / `*.scss` / 静态资源 / 路由 / 依赖 | `npm run type-check` + `npm run build:mp-weixin` |
| 交付 / 提测前 | `npm run build:mp-weixin` |
| 只改文档 / 注释 | 都不跑 |

（`type-check` 约 65 秒、`build:mp-weixin` 约 148 秒，两个都跑就是 3.5 分钟。）

**已知误报不要修**：`src/pages/*/index.vue` 上偶发的 Vetur `Module ... has no default export`（`vue-tsc` 不报）。

## 与后端的约定

```
响应外壳：{ code: 0, message: 'ok', data: T }     // code === 0 成功
分页数据：data: { list, total, page, pageSize }
异常：    code !== 0 前端抛 BizError；401（ApiCode.Unauthorized）走统一重登钩子
```

## 平台与主体约束（个人主体，很多事做不了）

- **不能用 `web-view`**（个人主体没有业务域名白名单）→ 外链一律"复制 + 提示"；
- **不能发订阅消息的长期订阅**（仅线下公共服务类目开放）→ 到点提醒只在打开小程序时由小枢做；
- **不能开微信支付**；**不能选「新闻资讯 / 社交 / 深度合成」类目** → 不做内容广场、不做 AI 生成内容的对外发布；
- **插件也受类目约束**：所用插件的类目必须落在个人主体开放的服务类目（9 大类）之内。
  微信同声传译插件属「IT科技-软件服务提供商」，**带着它提审会被驳回**（实测），所以语音转写有一条不经插件的后端通道
  （`POST /guanzhi/asr`）—— **提审前删掉 `src/manifest.json` 的 `mp-weixin.plugins` 整块**，代码会自动切到后端那条路，
  见 `src/config/voice.ts` 与后端 `services/asrService.js`，口径写在 `docs/观止知行-架构规格-v2.md` §6.8。
- **AI 有三道开关**（排查顺序固定）：`src/config/env.ts` 的 `DEV_AI_OFF`（**仅开发态**）、后端 `config/app-config.json` 的 `features.ai`（60 秒热生效）、后端 `.env` 的 `AI_ALLOWED_OPENIDS` 白名单。

## 隐私

`PRIVACY.md` 是**提交给微信的版本**（已与代码逐条核对），`PRIVACY-full.md` 是未来功能的条款预案（任何情况下都不得整篇提交）。
**凡是让数据离开手机的行为变更（新增接口、新增第三方、新增权限），必须先改这两份，再动代码。**

## 待办与上线前置

见 `docs/观止知行-未做事项.md`：提审前三件事（`DAILY_MODE=rule` / 删插件声明 / 配好语音转写引擎）、真机验证清单、尚未 commit 的批次。
