/**
 * 原生弹框的统一入口（2026-09-22）。
 *
 * 为什么要有它：全项目还有 40+ 处 `uni.showModal`（删除确认 / 报错提示）。
 * 原生弹框本身**不跟随皮肤**（底永远是白的），GzDialog 才是正解 —— 但把 40 处逐个搬进
 * GzDialog 需要每页都挂一个组件实例（组件必须挂在页面上，App.vue 不渲染 UI），
 * 是一次单独的改造（记在 docs/观止知行-未做事项.md 的 #20.3）。
 *
 * ⚠️ **需要用户输入的那一类已经全部搬完了**（2026-09-23）：GzDialog 有输入模式
 * （`input` + `placeholder` / `defaultValue` / `maxlength` / `multiline` / `inputType`，
 * `@confirm` 回传文本）。**不要再写 `uni.showModal({ editable: true })`** ——
 * 它把 `content` 当成输入框的**初始值**，于是那句"说明"要用户先删掉才能写字
 * （而且它同样不跟皮肤）。
 *
 * 在那之前，先用最小代价把**按钮颜色**对齐皮肤：所有调用改成走这里，
 * 主按钮取当前模式的 accent（绿 / 电光蓝 / 朱砂），弹框就不会在修仙模式下
 * 顶着一颗"普通模式绿"的确定键。
 *
 * 用法（与 `uni.showModal` 完全同参，显式传的 `confirmColor` 会覆盖默认值，
 * 破坏性操作照旧可以给语义红）：
 *   showModal({ title: '删掉这条', content: '删了就找不回来了', confirmText: '删',
 *               confirmColor: WARN_COLOR, cancelText: '留着', success: (r) => { ... } })
 */
import { getSkin } from '@/config/skins'
import { useModeStore } from '@/stores/mode'

type ModalOptions = Parameters<typeof uni.showModal>[0]

export function showModal(options: ModalOptions): void {
  const skin = getSkin(useModeStore().id)
  uni.showModal({
    /* 主按钮跟随当前皮肤；显式传了的以调用方为准（下面这一行在前，`...options` 在后） */
    confirmColor: skin.accent,
    ...options,
  })
}
