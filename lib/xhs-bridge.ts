/**
 * 小红书 isolated ⇄ MAIN world 通信协议（共享常量/类型）。
 *
 * 小红书把笔记数据放在页面 `window.__INITIAL_STATE__`，该变量仅存在于页面 MAIN world，
 * content script 的 isolated world 读不到。故由一个 `world: 'MAIN'` 的 content script
 * 读取并通过 `window.postMessage` 回传。两侧用同一个 marker + 一次性 token 校验，
 * 只接受同源（`event.source === window`）消息，避免被页面脚本伪造。
 */
export const XHS_MSG = 'owc-xhs'

export interface XhsNote {
  title: string
  desc: string
  images: string[]
}

export interface XhsReq {
  source: typeof XHS_MSG
  dir: 'req'
  token: string
}

export interface XhsRes {
  source: typeof XHS_MSG
  dir: 'res'
  token: string
  note: XhsNote | null
}
