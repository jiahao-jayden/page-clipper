import type { RawCapture } from '../lib/normalize'
import { saveWithActiveConnector } from '../lib/connectors'
import { normalizeTags } from '../lib/tags'

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'EXTRACT') {
      relayExtract(sendResponse)
      return true
    }
    if (msg.type === 'CAPTURE') {
      capture(
        msg.data as RawCapture | undefined,
        msg.note ?? '',
        normalizeMessageTags(msg.tags),
        sendResponse,
      )
      return true
    }
    return false
  })
})

/** 向当前活动标签页的 content script 转发 EXTRACT，把抽取结果回传给 popup。 */
async function relayExtract(sendResponse: (r: unknown) => void) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    sendResponse({ ok: false, error: 'No active tab' })
    return
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' })
    sendResponse(res)
  } catch {
    sendResponse({
      ok: false,
      error: 'Content script not ready — reload the page and try again',
    })
  }
}

function normalizeMessageTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return normalizeTags(value.filter((item): item is string => typeof item === 'string'))
}

/** 用已抽取好的 data + 备注直接写入 vault（不再二次抽取）。 */
async function capture(
  data: RawCapture | undefined,
  note: string,
  tags: string[],
  sendResponse: (r: unknown) => void,
) {
  if (!data) {
    sendResponse({ ok: false, error: 'No extracted data to capture' })
    return
  }
  const capture: RawCapture = { ...data, user_note: note, tags }

  try {
    const { path } = await saveWithActiveConnector(capture)
    sendResponse({ ok: true, path })
  } catch (e) {
    sendResponse({ ok: false, error: String(e), needsSettings: true })
  }
}
