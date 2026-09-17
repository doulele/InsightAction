/**
 * 个人**名号**（昵称 / 头像）—— 默认只存在本机。
 * ================================================
 *
 * 与修行数据同源同命运：存在 pinia 持久化里（key = identity），
 * 因此自动跟着「本地备份导出 / 云备份」走，导出与备份也自动包含它 —— 不需要另外登记。
 *
 * 名字为什么要叫 identity 而不是 profile：`utils/profile.ts` 已经是「自我画像」
 * （从脊椎里算出来的形状），两个东西都与"我是谁"有关但完全不同 ——
 * 那个是**算出来的**，这个是**你自己设的**，撞名只会互相误导。
 *
 * 两个刻意的设计：
 *  1. 头像必须**拷进私有永久目录**：`chooseAvatar` 给的是临时文件路径，
 *     临时目录会被系统清理，直接用会出现「头像是裂的 / 隔天没了」。
 *     这里先拷、成功后再删旧图（拷贝失败保留原头像，不置空）。
 *  2. 冷启动自检文件是否还在（verify）：换机恢复、清缓存之后，
 *     持久化的路径会指向一个不存在的文件 —— 只把这一张清掉，展示回落到「名字章」。
 *
 * 合规口径见 PRIVACY.md：头像昵称只在用户主动设置时获取，默认不过网；
 * 用户开了云备份之后，它会随备份一起上传（这也是唯一离开本机的路径）。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { copyToUserDir, fileExists, isTempPath, removeFile } from '@/utils/localFile'

/** 头像文件名前缀（落在私有目录 wx.env.USER_DATA_PATH 下） */
const AVATAR_PREFIX = 'gz-avatar-'

/** 昵称上限：微信昵称本身可到 32 字符，这里收紧到 16，与 UI 排版一致 */
const NAME_MAX = 16

export const useIdentityStore = defineStore(
  'identity',
  () => {
    const nickname = ref('')
    /** 头像的本地路径（私有目录下）；空 = 用「昵称首字」的默认章 */
    const avatar = ref('')
    /** 最近一次修改时间（ISO），用于看得见"这是我自己刚改的" */
    const updatedAt = ref('')

    /** 是否已经有名有号（未设置时界面把它当作"还没起号"的引导入口） */
    const settled = computed(() => Boolean(nickname.value || avatar.value))
    /** 没有头像时的替代表现：昵称首字，缺省「我」 */
    const initial = computed(() => nickname.value.trim()[0] || '我')

    function setNickname(name: string): void {
      nickname.value = (name || '').trim().slice(0, NAME_MAX)
      updatedAt.value = new Date().toISOString()
    }

    /**
     * 保存头像。入参是 `chooseAvatar` 给的**临时**文件路径，会被系统清理，
     * 必须先拷到私有永久目录（拷贝本身带 base64 重写兜底，见 utils/localFile）。
     * 返回 false = 没能落盘（调用方据此提示）。
     */
    function setAvatar(tmpPath: string): boolean {
      if (!tmpPath) return false
      const ext = /\.([a-zA-Z0-9]+)$/.exec(tmpPath)?.[1] || 'png'
      const dest = copyToUserDir(tmpPath, `${AVATAR_PREFIX}${Date.now()}.${ext}`)
      if (!dest) return false
      /* 只有新图落盘成功才换指针、删旧图 —— 中途失败不至于连老头像也没了 */
      const old = avatar.value
      avatar.value = dest
      updatedAt.value = new Date().toISOString()
      if (old && old !== dest) removeFile(old)
      return true
    }

    /** 用回默认：抹掉昵称与头像（连带删掉本机头像文件） */
    function clear(): void {
      const old = avatar.value
      nickname.value = ''
      avatar.value = ''
      updatedAt.value = ''
      removeFile(old)
    }

    /**
     * 冷启动自检：持久化的头像路径可能已失效（换机恢复 / 系统清理）。
     * 与 stores/images.ts 的 verifyExisting 同一套路：只对真实本地路径动手。
     */
    function verify(): void {
      const path = avatar.value
      if (!path) return
      /*
       * 极端情况：存下来的还是临时路径（早期版本 / 拷贝失败留下的）。
       * 趁冷启动再搬一次家；搬不动说明文件已经没了 → 回落成「名字章」。
       */
      if (isTempPath(path)) {
        const dest = copyToUserDir(path, `${AVATAR_PREFIX}${Date.now()}.png`)
        avatar.value = dest
        return
      }
      if (!fileExists(path)) avatar.value = ''
    }

    return { nickname, avatar, updatedAt, settled, initial, setNickname, setAvatar, clear, verify }
  },
  {
    persist: { key: 'identity', paths: ['nickname', 'avatar', 'updatedAt'] },
  },
)
