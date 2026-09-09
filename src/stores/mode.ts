/**
 * 模式 store —— 记录用户选择的三模式之一（普通/科技/修仙）。
 *
 * 说明：
 *  - 修行数据不随模式分叉，此 store 只决定「叫法与文案层」；
 *  - 切换模式会清空当前修行进度（产品约定），清空动作在设置页触发，不在此处。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_MODE_ID, getModeMeta } from '@/config/modes'
import type { ModeId } from '@/config/modes'

export const useModeStore = defineStore(
  'mode',
  () => {
    /** 当前模式 */
    const id = ref<ModeId>(DEFAULT_MODE_ID)

    /** 当前模式的完整元数据（label / 测评名 / 成长体系名…） */
    const meta = computed(() => getModeMeta(id.value))

    function setMode(next: ModeId): void {
      id.value = next
    }

    return { id, meta, setMode }
  },
  {
    persist: { key: 'mode', paths: ['id'] },
  },
)
