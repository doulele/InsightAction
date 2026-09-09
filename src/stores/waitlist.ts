/**
 * 等候名单 store：演示「store 调 api + 持久化 + 页面响应式」的完整链路。
 * 观止知行页的「加入静修等候」按钮会驱动这里的状态。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { joinWaitlist } from '@/api/modules/insight'

export const useWaitlistStore = defineStore(
  'waitlist',
  () => {
    /** 是否已加入等候名单 */
    const joined = ref(false)
    /** 后端分配的排队号 */
    const queueNo = ref(0)
    /** 加入时间 */
    const joinedAt = ref('')
    /** 是否正在提交 */
    const submitting = ref(false)

    /** 提交加入（幂等：已加入则不再重复请求） */
    async function join(): Promise<void> {
      if (joined.value || submitting.value) return
      submitting.value = true
      try {
        const res = await joinWaitlist()
        joined.value = res.joined
        queueNo.value = res.queueNo
        joinedAt.value = new Date().toISOString()
      } finally {
        submitting.value = false
      }
    }

    return { joined, queueNo, joinedAt, submitting, join }
  },
  {
    persist: { key: 'waitlist', paths: ['joined', 'queueNo', 'joinedAt'] },
  },
)
