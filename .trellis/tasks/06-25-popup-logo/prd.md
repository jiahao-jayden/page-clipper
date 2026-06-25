# popup 右上角显示当前渠道 logo

## Goal

在剪藏 popup 的右上角，把当前"文字 badge"（显示 `source_platform`）升级为对应渠道/平台的品牌 logo，让用户一眼识别当前所在环境（知乎 / 微信 / B站 / GitHub / YouTube …），提升辨识度与观感。

## What I already know

- popup 已是 React + shadcn（`entrypoints/popup/App.tsx`），右上角现有一个 `Badge variant="secondary"` 显示 `capture.source_platform` 文本。
- 平台值来源于抽取结果 `RawCapture.source_platform`，可能取值：
  `x` `zhihu` `wechat` `weibo` `xiaohongshu` `reddit` `medium` `github` `youtube` `hackernews` `bilibili`，通用兜底 `article`。
- 平台判定逻辑在 `lib/extract/pipeline.ts` 的 `hostToPlatform()` / `platformFromExtractor()`，以及各 adapter 内硬编码。
- 当前 logo 只有 lucide（通用图标，无品牌色 logo）。

## Assumptions (temporary)

- "检测环境" 指识别当前页面属于哪个渠道——可直接复用 `source_platform`，或在 popup 打开时基于当前 tab URL 立即判定（更快、不依赖抽取成功）。
- 需要品牌 logo（带各平台标志），而非通用占位图标。

## Requirements

- popup 打开时基于当前 tab 的 URL **即时**判定渠道并显示 logo，不依赖抽取是否完成。
- logo 通过 Google favicon 服务获取：`https://www.google.com/s2/favicons?sz=64&domain=<hostname>`。
- 右上角形式为 **logo + 平台名文字**（替换现有纯文字 badge）。
- 平台名优先用抽取结果 `source_platform`，抽取前/未知时用基于 hostname 的推断值。
- favicon 加载失败（断网/无图标）时优雅降级为通用占位图标（lucide `Globe`），不破版。

## Acceptance Criteria

- [ ] 在 GitHub/知乎/B站等页面打开 popup，右上角即时显示该站 favicon + 平台名。
- [ ] 抽取完成后平台名以 `source_platform` 为准刷新（若与即时推断不同）。
- [ ] favicon 加载失败时显示 `Globe` 占位图标，不报错、不破版。
- [ ] 通用/未知页面正常显示（favicon + `article` 或域名）。

## Definition of Done

- Lint / typecheck / build 通过。
- hostname→平台名推断逻辑集中、可复用（不让 popup 拖入 defuddle/turndown 重依赖）。

## Decision (ADR-lite)

**Context**: 需要在右上角直观展示当前渠道。品牌 SVG 包（simple-icons）虽离线但需维护映射且体积增加；用户倾向用现成 favicon。
**Decision**: 采用 Google favicon 服务（`s2/favicons`）按 hostname 取 logo；即时基于 URL 检测；展示 logo + 文字；失败降级为 lucide `Globe`。
**Consequences**: 零额外品牌资源、自动适配任意站点；代价是需联网且向 Google 暴露所访问域名（可接受，剪藏本身即在线场景）。MV3 popup 默认 CSP 不限制 img-src，远程图片可直接 `<img>` 加载，无需额外 host_permissions。

## Out of Scope

- 不改动抽取逻辑与平台判定规则本身。
- 不引入离线品牌图标包。

## Technical Notes

- 文件影响面：`entrypoints/popup/App.tsx`（UI）+ 将 `lib/extract/pipeline.ts` 的 `hostToPlatform()` 抽到轻量 `lib/platform.ts` 供 popup 与 pipeline 共用（避免 popup import pipeline 而打包进 defuddle/turndown）。
- 即时获取当前 URL：`chrome.tabs.query({ active: true, currentWindow: true })`。
