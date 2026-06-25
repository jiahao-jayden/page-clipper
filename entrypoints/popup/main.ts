import { toMarkdown } from '../../lib/normalize'
import type { RawCapture } from '../../lib/normalize'

const preview = document.getElementById('preview') as HTMLDivElement
const note = document.getElementById('note') as HTMLTextAreaElement
const platform = document.getElementById('platform') as HTMLSpanElement
const clipBtn = document.getElementById('clip') as HTMLButtonElement
const copyBtn = document.getElementById('copy') as HTMLButtonElement
const status = document.getElementById('status') as HTMLDivElement

let capture: RawCapture | null = null

/** 用已抽取的 RawCapture + 当前备注本地拼出完整 markdown（与写入一致）。 */
function currentMarkdown(): string {
  if (!capture) return ''
  return toMarkdown({ ...capture, user_note: note.value })
}

function renderPreview() {
  if (!capture) return
  preview.classList.remove('empty')
  preview.textContent = currentMarkdown()
}

function setStatus(text: string, cls = '') {
  status.textContent = text
  status.className = cls
}

async function init() {
  setStatus('正在抽取…', 'muted')
  try {
    const res = await chrome.runtime.sendMessage({ type: 'EXTRACT' })
    if (res?.ok && res.data) {
      capture = res.data as RawCapture
      platform.textContent = capture.source_platform
      platform.hidden = false
      renderPreview()
      clipBtn.disabled = false
      copyBtn.disabled = false
      setStatus('')
    } else {
      preview.textContent = '未能抽取内容'
      setStatus(`✗ ${res?.error ?? '抽取失败'}`, 'err')
    }
  } catch (e) {
    preview.textContent = '未能抽取内容'
    setStatus(`✗ ${String(e)}`, 'err')
  }
}

note.addEventListener('input', renderPreview)

clipBtn.addEventListener('click', async () => {
  if (!capture) return
  clipBtn.disabled = true
  copyBtn.disabled = true
  setStatus('剪藏中…', 'muted')
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'CAPTURE',
      data: capture,
      note: note.value,
    })
    if (res?.ok) {
      setStatus(`✓ 已保存到\n${res.path}`, 'ok')
    } else {
      setStatus(`✗ ${res?.error ?? '保存失败'}`, 'err')
    }
  } catch (e) {
    setStatus(`✗ ${String(e)}`, 'err')
  } finally {
    clipBtn.disabled = false
    copyBtn.disabled = false
  }
})

copyBtn.addEventListener('click', async () => {
  if (!capture) return
  try {
    await navigator.clipboard.writeText(currentMarkdown())
    setStatus('✓ 已复制完整 Markdown', 'ok')
  } catch (e) {
    setStatus(`✗ 复制失败：${String(e)}`, 'err')
  }
})

init()
