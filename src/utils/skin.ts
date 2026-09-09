/**
 * 观止知行 · 皮肤应用器
 * ======================
 *
 * 把当前 mode 对应的「原生控件」颜色同步到小程序运行时。
 * CSS 侧（页面背景/文字/分割线等）由 .gz-skin--xxx 类自动注入 CSS 变量，不在这里处理。
 *
 * 两条铁律：
 *  1. setTabBarItem / setTabBarStyle 只能在「本就是 tabBar 的页面」上调用；
 *     启动首帧 / 启动页 / 模式选择页都不是（或尚未就绪），会直接报 “not TabBar page”。
 *  2. setNavigationBarColor 的 frontColor 只接受 #000000 / #ffffff 十六进制；
 *     传 'black' / 'white' 会被判为 invalid。
 *
 * 因此拆成两个入口：
 *   1. applySkin —— 导航栏 + 窗口背景，任意页面可安全调用；
 *   2. syncTabBar —— tabBar 样式与图标，只在各大厅页 onShow 时调用（此时必然是 tabBar 页）。
 *
 * 原生控件 API 是异步的，失败走 fail 回调；若没传 fail，基础库会把错误直接上报到控制台
 * （表现为 MiniProgramError）。所以这里统一注入 fail 回调静默吞掉「尚未就绪/非 tabBar 页」等
 * 可自愈失败，并把状态标记清空，等下一次 onShow 自动重试。
 *
 * 触发时机：
 *  1. App.vue onLaunch → applySkin
 *  2. App.vue 监听 modeStore.id → applySkin
 *  3. 各 tabBar 页 onShow → syncTabBar
 *  4. 「我」页直接切换模式 → applySkin + syncTabBar（该页本身是 tabBar 页）
 */
import { TAB_LABEL, TAB_ORDER, getSkin } from '@/config/skins'
import type { ModeId } from '@/config/modes'

/** 导航栏/背景色当前生效的模式；tabBar 图标的同步进度独立记录 */
let lastNavId: ModeId | null = null
let lastTabId: ModeId | null = null

interface CallOpts {
  args: object
  /** 成功回调（可选） */
  onOk?: () => void
  /** 失败回调：默认忽略（tabBar 未就绪 / 非 tabBar 页 / 原生控件暂不可用等可自愈情形） */
  onFail?: () => void
}

function call(method: string, { args, onOk, onFail }: CallOpts): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (uni as unknown as Record<string, (a: object) => void>)[method]
  if (typeof fn !== 'function') return
  try {
    fn({
      ...args,
      success: () => onOk?.(),
      fail: () => {
        // 不向控制台上报可自愈失败；需要重试的由调用方在 onFail 里重置标记
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[skin] ${method} silently ignored (not ready / not a tabBar page?)`)
        }
        onFail?.()
      },
    })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[skin] ${method} sync throw:`, e)
    }
    onFail?.()
  }
}

/** 原生导航栏 + 窗口背景（任意页面可用；切模式即调） */
export function applySkin(id: ModeId, force = false): void {
  if (!force && id === lastNavId) return
  const s = getSkin(id)

  const reset = () => {
    lastNavId = null
  }

  call('setNavigationBarColor', {
    args: {
      frontColor: s.navigationBar.frontColor,
      backgroundColor: s.navigationBar.backgroundColor,
      animation: { duration: 220, timingFunc: 'easeOut' },
    },
    onOk: () => {
      lastNavId = id
    },
    onFail: reset,
  })
  call('setBackgroundColor', {
    args: {
      backgroundColor: s.windowBackground,
      backgroundColorTop: s.windowBackground,
      backgroundColorBottom: s.windowBackground,
    },
  })

  // 模式变了 → 下一次大厅页 onShow 需要重新同步 tabBar
  lastTabId = null
}

/** tabBar 样式 + 图标（仅在 tabBar 页 onShow / tabBar 页内切模式后调用） */
export function syncTabBar(id: ModeId, force = false): void {
  if (!force && id === lastTabId) return
  const s = getSkin(id)

  // tabBar 尚未就绪时静默失败，并清掉进度，让下一次 onShow 自动重试
  const retry = () => {
    lastTabId = null
  }

  call('setTabBarStyle', {
    args: {
      color: s.tabBar.color,
      selectedColor: s.tabBar.selectedColor,
      backgroundColor: s.tabBar.backgroundColor,
      borderStyle: s.tabBar.borderStyle,
    },
    onOk: () => {
      lastTabId = id
    },
    onFail: retry,
  })

  TAB_ORDER.forEach((key, index) => {
    const ic = s.tabIcons[key]
    call('setTabBarItem', {
      args: {
        index,
        text: TAB_LABEL[key],
        iconPath: ic.default,
        selectedIconPath: ic.active,
      },
      onOk: () => {
        lastTabId = id
      },
      onFail: retry,
    })
  })
}
