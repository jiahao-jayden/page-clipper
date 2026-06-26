# Wiki Clipper

剪藏网页内容到 Obsidian wiki 的 `_raw/bookmarks/`，输出规范字段。

## 技术栈

- [WXT](https://wxt.dev/) + TypeScript（Manifest V3）
- Bun 运行时
- 通过 Obsidian Local REST API 写入 vault

## 前置条件

1. Obsidian 装并启用 **Local REST API** 插件
2. 在插件设置里拿到 API key（如启用了鉴权）
3. 在扩展的设置页（popup 右上角设置图标，或扩展 options 入口）填写 Obsidian REST URL、密钥，并可选配置保存基础目录与路径模板

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
  background.ts      # 协调：收 popup 消息 → 让 content 抽取 → 写 vault
  content.ts         # 注入页面，按 adapter 抽取内容
  popup/             # 点图标的剪藏 UI
lib/
  adapters/
    twitter.ts       # X/Twitter 推文/线程
    generic.ts       # 兜底：Readability 式正文抽取（Reddit/Medium/文章）
  normalize.ts       # 统一规范字段 + Markdown 序列化
  vault.ts           # Local REST API 写入
```

## 写入路径

`_raw/bookmarks/{platform}/{YYYY-MM-DD}-{slug}.md`

平台由 adapter 判定：x / reddit / medium / github / youtube / article。
