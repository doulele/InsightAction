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

export const useModeStore = defineStore(
  'mode',
  () => {
    /** 当前模式 */
    const id = ref<ModeId>(DEFAULT_MODE_ID)

    /** 当前模式的完整元数据（label / 测评名 / 成长体系名…） */
    const meta = computed(() => getModeMeta(id.value))

    /** 后端下发的横幅图：mode → url（持久化，冷启动先用手里的旧地址，不闪白） */
    const skins = ref<Partial<Record<ModeId, string>>>({})

    /** 是否拿到了远端横幅 */
    const hasRemoteSkins = computed(() => Object.keys(skins.value).length > 0)

    function setMode(next: ModeId): void {
      id.value = next
    }

    /**
     * 取任意模式的横幅图地址。
     * 优先级：后端下发 → 构建期 VITE_SKIN_BASE_URL → undefined（走兜底饰带）
     */
    function artOf(target: ModeId): string | undefined {
      return skins.value[target] ?? getModeMeta(target).art
    }

    /** 当前模式的横幅图 */
    const art = computed(() => artOf(id.value))

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
      } catch {
        // 忽略：接口不可用时保持现状（可能为空 → 页面用渐变兜底）
      }
    }

    return { id, meta, skins, hasRemoteSkins, art, artOf, setMode, loadSkins }
  },
  {
    persist: { key: 'mode', paths: ['id', 'skins'] },
  },
)
