import { defineConfig, type WxtViteConfig } from 'wxt'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
  },
  vite: () => ({
    plugins: [tailwindcss()],
  } as WxtViteConfig),
  manifest: {
    name: 'Page Clipper',
    version: '0.1.0',
    description: '把任意网页一键复制为干净的 Markdown，可选保存到 Obsidian',
    permissions: ['activeTab', 'tabs', 'storage'],
    host_permissions: [
      'http://localhost/*',
      'http://127.0.0.1/*',
      'https://localhost/*',
      'https://127.0.0.1/*',
      // B站字幕：defuddle 的 bilibili extractor 在 content script 内 fetch 这些域
      // （view→player/v2→subtitle_url，credentials:'include'），需放开跨域。
      '*://api.bilibili.com/*',
      '*://*.hdslb.com/*',
    ],
  },
})
