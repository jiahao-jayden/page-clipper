import { XHS_MSG, type XhsNote, type XhsReq, type XhsRes } from '../lib/xhs-bridge'

/**
 * 小红书 MAIN world 探针。
 *
 * 运行在页面真实 JS 上下文（`world: 'MAIN'`），是唯一能读到 `window.__INITIAL_STATE__`
 * 的地方。被动监听 isolated world content script 发来的请求，提取当前笔记的
 * title/desc/imageList 后回传纯对象（structured clone 安全）。不主动抓取、不发网络请求。
 */
export default defineContentScript({
  matches: ['*://*.xiaohongshu.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as XhsReq | undefined
      if (!data || data.source !== XHS_MSG || data.dir !== 'req' || !data.token) return

      let note: XhsNote | null = null
      try {
        note = extractNote()
      } catch {
        note = null
      }

      const res: XhsRes = { source: XHS_MSG, dir: 'res', token: data.token, note }
      window.postMessage(res, location.origin)
    })
  },
})

/** 从 URL 取笔记 id（/explore/{id} 或 /discovery/item/{id}）。 */
function getNoteId(): string {
  const m = location.pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-fA-F]+)/)
  return m ? m[1] : ''
}

type Dict = Record<string, unknown>

function asDict(v: unknown): Dict {
  return v && typeof v === 'object' ? (v as Dict) : {}
}

/**
 * 从 `__INITIAL_STATE__.note.noteDetailMap` 定位当前笔记。
 * 优先按 URL id / currentNoteId / firstNoteId，取不到则退而取 map 第一条。
 */
function extractNote(): XhsNote | null {
  const state = (window as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__
  if (!state) return null

  const noteModule = asDict(asDict(state).note)
  const map = asDict(noteModule.noteDetailMap)

  const id =
    getNoteId() ||
    unwrap(noteModule.currentNoteId) ||
    unwrap(noteModule.firstNoteId) ||
    ''

  let entry = id ? map[id] : undefined
  if (!entry) {
    const keys = Object.keys(map)
    if (keys.length) entry = map[keys[0]]
  }

  const entryDict = asDict(entry)
  const note = asDict(entryDict.note ?? entry)

  const title = String(note.title ?? '').trim()
  const desc = String(note.desc ?? '').trim()
  const list = note.imageList ?? note.imagesList
  const images = Array.isArray(list)
    ? list
        .map((im) => {
          const d = asDict(im)
          return String(d.urlDefault || d.url || d.urlPre || '')
        })
        .filter((u) => !!u)
    : []

  if (!title && !desc && images.length === 0) return null
  return { title, desc, images }
}

/** 小红书部分字段被包成 `{ value }` ref 结构，做一层解包。 */
function unwrap(v: unknown): string {
  if (typeof v === 'string') return v
  const value = asDict(v).value
  return typeof value === 'string' ? value : ''
}
