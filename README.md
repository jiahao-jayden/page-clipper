# Page Clipper

把任意网页一键抽取为干净的 Markdown 并复制到剪贴板。保存到 Obsidian（经 Local REST API 写入 `_raw/bookmarks/`）是可选附加功能，默认关闭，在设置页开启。

## 技术栈

- [WXT](https://wxt.dev/) + TypeScript（Manifest V3）
- Bun 运行时
- 可选：通过 Obsidian Local REST API 写入 vault

## 使用

1. 打开目标网页，点击扩展图标，popup 会自动抽取正文并生成 Markdown 预览。
2. 点击「复制 Markdown」即可把完整内容（含 frontmatter、备注、标签）复制到剪贴板，贴到任意笔记工具。

### 可选：保存到 Obsidian

1. 在扩展设置页（popup 右上角设置图标，或扩展 options 入口）打开「保存到 Obsidian」开关。
2. Obsidian 装并启用 **Local REST API** 插件，拿到 API key（如启用了鉴权）。
3. 填写 Obsidian REST URL、密钥，并可选配置保存基础目录与路径模板。
4. 开启后 popup 会多一个「保存到 Obsidian」按钮，用于写入 vault；复制功能始终可用。

## 开发

```bash
bun install
bun run dev      # 启动开发模式，自动打开带扩展的 Chrome
```

`bun run dev` 会在 `.output/` 生成扩展并热重载。也可手动加载 `.output/chrome-mv3/`（chrome://extensions → 加载已解压的扩展程序）。

## 构建

```bash
bun run build    # 产物在 .output/chrome-mv3/
bun run zip      # 打包
```

## 结构

```
entrypoints/
  background.ts      # 协调：收 popup 消息 → 让 content 抽取 → 可选写入 vault
  content.ts         # 注入页面，按 adapter 抽取内容
  popup/             # 点图标的复制 / 剪藏 UI
lib/
  adapters/
    twitter.ts       # X/Twitter 推文/线程
    generic.ts       # 兜底：Readability 式正文抽取（Reddit/Medium/文章）
  normalize.ts       # 统一规范字段 + Markdown 序列化
  connectors/        # 可选保存目标（Obsidian 等）
  vault.ts           # Obsidian Local REST API 写入
```

## 保存路径（启用 Obsidian 导出时）

`_raw/bookmarks/{platform}/{YYYY-MM-DD}-{slug}.md`

平台由 adapter 判定：x / reddit / medium / github / youtube / article。
