/**
 * 模式 store —— 记录用户选择的三模式之一（普通/科技/修仙）。
 *
 * 说明：
 *  - 修行数据不随模式分叉，此 store 只决定「叫法与文案层」；
 *  - 切换模式会清空当前修行进度（产品约定），清空动作在设置页触发，不在此处；
 *  - 横幅图（art）优先取后端下发，取不到则回退到构建期静态配置，
 *    两者都没有时返回 undefined，页面显示主题渐变兜底（不请求坏地址）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_MODE_ID, getModeMeta } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import { fetchSkinConfig } from '@/api/modules/skins'
import { markUrl } from '@/config/marks'
import type { MarkKey } from '@/config/marks'
import { useImageStore } from './images'

export const useModeStore = defineStore(
  'mode',
  () => {
    /** 当前模式 */
    const id = ref<ModeId>(DEFAULT_MODE_ID)

    /** 当前模式的完整元数据（label / 测评名 / 成长体系名…） */
    const meta = computed(() => getModeMeta(id.value))

    /** 后端下发的横幅图：mode → url（持久化，冷启动先用手里的旧地址，不闪白） */
    const skins = ref<Partial<Record<ModeId, string>>>({})

    /**
     * 后端下发的模块标志物地址：模块键 → mode → url（可选，持久化）。
     * 后端没配时前端按"横幅同目录 + 固定文件名"推导兜底，两端可独立升级。
     */
    const marks = ref<Partial<Record<MarkKey, Partial<Record<ModeId, string>>>>>({})

    /** 是否拿到了远端横幅 */
    const hasRemoteSkins = computed(() => Object.keys(skins.value).length > 0)

    function setMode(next: ModeId): void {
      id.value = next
    }

    /**
     * 取任意模式的**远端**横幅地址（不做本地缓存）。
     * 优先级：后端下发 → 构建期 VITE_SKIN_BASE_URL → undefined（走兜底饰带）。
     *
     * 用途：推导标志物的同目录前缀（config/marks.ts 的 markUrl）与启动预热。
     */
    function remoteArtOf(target: ModeId): string | undefined {
      return skins.value[target] ?? getModeMeta(target).art
    }

    /**
     * 取横幅图地址（供 `<image :src>` 用）。
     * 已下载过 → 本地文件路径（磁盘直读，不再打网）；否则返回远端地址并后台下载，
     * 下载完成后响应式切换为本地路径（见 stores/images.ts）。
     */
    function artOf(target: ModeId): string | undefined {
      return useImageStore().resolve(remoteArtOf(target))
    }

    /** 当前模式的横幅图 */
    const art = computed(() => artOf(id.value))

    /**
     * 取模块标志物地址：**接口下发优先**，没配则按"横幅同目录 + 固定文件名"推导兜底。
     *
     * 下发的意义：图换目录、上 CDN、加签名参数时前端不用改；推导兜底的意义：
     * 后端还没更新时功能照样完整（两端可独立上线）。
     */
    function markOf(key: MarkKey, mode: ModeId): string | undefined {
      return marks.value[key]?.[mode] ?? markUrl(key, mode, remoteArtOf(mode))
    }

    /**
     * 拉取后端横幅配置（App onLaunch 调一次即可）。
     * 静默失败：横幅缺失不影响任何功能，页面已有主题兜底；
     * 成功后整表替换，避免后端删图后本地还留着旧地址。
     */
    async function loadSkins(): Promise<void> {
      try {
        const cfg = await fetchSkinConfig()
        const next: Partial<Record<ModeId, string>> = {}
        for (const item of cfg?.skins ?? []) {
          if (item?.mode && item?.url) next[item.mode] = item.url
        }
        if (Object.keys(next).length > 0) skins.value = next
        /* 标志物地址表（可选）：有就整表替换，没有就保持原样（继续走推导兜底） */
        if (cfg?.marks && typeof cfg.marks === 'object') marks.value = cfg.marks
      } catch {
        // 忽略：接口不可用时保持现状（可能为空 → 页面用渐变兜底）
      }
    }

    return { id, meta, skins, marks, hasRemoteSkins, art, artOf, remoteArtOf, markOf, setMode, loadSkins }
  },
  {
    persist: { key: 'mode', paths: ['id', 'skins', 'marks'] },
  },
)
