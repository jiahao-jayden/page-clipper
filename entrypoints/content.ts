import { extractForUrl } from '../lib/adapters'

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type !== 'EXTRACT') return false
      ;(async () => {
        try {
          const data = await extractForUrl(location.href)
          sendResponse({ ok: true, data })
        } catch (e) {
          sendResponse({ ok: false, error: String(e) })
        }
      })()
      return true
    })
  },
})
