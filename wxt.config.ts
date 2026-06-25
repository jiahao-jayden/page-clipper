import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'Obsidian Wiki Clipper',
    version: '0.1.0',
    description: '剪藏网页内容到 Obsidian wiki',
    permissions: ['activeTab', 'tabs'],
    host_permissions: [
      'http://localhost:27123/*',
      'http://127.0.0.1:27123/*',
      // B站字幕：defuddle 的 bilibili extractor 在 content script 内 fetch 这些域
      // （view→player/v2→subtitle_url，credentials:'include'），需放开跨域。
      '*://api.bilibili.com/*',
      '*://*.hdslb.com/*',
    ],
  },
})
