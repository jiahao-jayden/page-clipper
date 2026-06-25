import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'Obsidian Wiki Clipper',
    version: '0.1.0',
    description: '剪藏网页内容到 Obsidian wiki',
    permissions: ['activeTab', 'tabs'],
    host_permissions: ['http://localhost:27123/*', 'http://127.0.0.1:27123/*'],
  },
})
