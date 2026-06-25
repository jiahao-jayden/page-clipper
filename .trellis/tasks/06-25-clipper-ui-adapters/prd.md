# 改进剪藏 UI 与平台适配

## Goal

当前剪藏扩展是个"毛坯"：popup UI 简陋、视觉不佳；平台适配只有 Twitter/X 一个专门 adapter，其余网站全部走 generic 兜底抽取，质量参差。目标是把它打磨成一个好看、好用、对主流平台有专门优化的剪藏工具。

## What I already know（来自代码库）

- 技术栈：WXT (`^0.20.27`) + TypeScript，Chrome MV3 扩展。
- 数据流：popup 点击 → `background.ts` 发 `CAPTURE` → `content.ts` 收 `EXTRACT` → adapter 抽取 → `normalize.toMarkdown` → `vault.writeRaw` PUT 到 Obsidian Local REST API。
- 写入路径：`_raw/bookmarks/{platform}/{date}-{slug}.md`，frontmatter 含 source_platform/source_id/canonical_url/title/author/captured_at/outbound_urls/user_note/tags。
- 现有 adapter：
  - `lib/adapters/twitter.ts`：匹配 `x.com|twitter.com/*/status/*`，抓 `tweetText` 节点拼接。
  - `lib/adapters/generic.ts`：兜底，取 `<article>/main/body` 的 innerText，按 hostname 粗分类为 reddit/medium/github/youtube/article（但抽取逻辑都一样，没有针对性）。
- popup UI：`entrypoints/popup/index.html` 单文件内联 CSS，320px 宽，一个 textarea 备注框 + 紫色按钮 + 状态文本。
- 配置：vault URL/KEY 走 `import.meta.env.VITE_OBSIDIAN_REST_*`（编译期环境变量，运行时不可改）。
- 权限：`activeTab`, `tabs`；host_permissions 仅 localhost:27123。

## Open Questions（已全部解决）

- ~~抽取深度~~ → 正文 + 图片 + 视频字幕；不做额外元数据/评论
- ~~markdown 模板差异化~~ → 统一 frontmatter，正文走统一 turndown 管线
- ~~UI 范围~~ → 美化 popup + 预览区 + 复制按钮；不加设置页
- ~~debug 复制内容~~ → 完整 markdown（含 frontmatter），与写入一致

## Requirements (evolving)

- UI：重做 popup 视觉与交互。
- 适配：为以下平台增加专门 adapter（已确认全选）：
  知乎、微信公众号、小红书、B站、微博、Reddit、Medium、GitHub、YouTube、Hacker News。
- **Debug/预览复制按钮**：点击后将"将要写入的 markdown"复制到剪贴板，方便核对抽取结果（最好是 markdown 格式）。

## 抽取深度（已确认）

- ✅ 高质量正文（去广告/导航/推荐，保留标题/段落/代码块/列表）
- ✅ 正文图片（markdown 图链保留，不下载）
- ✅ 视频字幕/速记（YouTube、B站）
- ❌ 不做点赞/收藏数等额外元数据（保留现有 frontmatter 的作者/时间/canonical_url 即可）
- ❌ 不抓评论/回复

## Acceptance Criteria (evolving)

- [ ] popup 视觉明显改善（具体标准待定）
- [ ] popup 打开即自动抽取并展示 markdown 预览区
- [ ] 上述 10 个平台均有专门 adapter，抽取质量优于 generic（正文干净、保留图片、视频含字幕）
- [ ] popup 有「复制 markdown」按钮，复制内容与实际写入一致

## Definition of Done

- 构建通过（`pnpm build` / wxt build），无 TS 报错
- 在目标平台手动验证抽取结果正确
- 行为变更同步到 README/注释（若有）

## Out of Scope (explicit)

- 运行时设置页（vault 地址/密钥仍走 `.env.local`）
- 点赞/收藏/转发等社交计数元数据
- 评论/回复抓取
- 图片下载到本地（仅保留图链）
- 登录态/反爬绕过（抓不到时回退 generic + 保底存 URL）

## Decision (ADR-lite)

**Context**：现有为"毛坯"——UI 简陋、仅 twitter 专门适配、其余走低质 generic（innerText 丢图丢格式）。调研发现 defuddle 已覆盖大半平台。
**Decision**：① 引入 defuddle + turndown(+gfm) 做统一高质量提取/转换（取代自写 Readability 兜底）；② defuddle 覆盖的 6 平台 + 通用页直接复用，仅自写 4 个中文平台 adapter；③ 每平台 adapter + 路由器架构；④ popup 改为打开即预览 + 复制 markdown + 简洁明亮风；⑤ 抽取聚焦正文/图片/字幕，砍掉计数元数据与评论（defuddle 在 Reddit/HN 顺带给的评论不强求）；⑥ 不加设置页。
**Consequences**：新增 defuddle + turndown + turndown-plugin-gfm 依赖；defuddle 自述 WIP 需锁版本；自写工作量从「10 平台」降到「4 中文平台」，大幅减负；小红书需 MAIN world 注入、B站字幕/小红书正文依赖登录态（首启需提示登录）；中文图床防盗链可能致 Obsidian 侧图链加载失败（属「仅存图链」已知限制）。

## Implementation Plan（修订，分小 PR）

- **PR1 基建**：引入 defuddle + turndown(+gfm)；新增 adapter 路由注册表替换 `content.ts` 三元判断；generic 升级为 defuddle 提取；用 defuddle 覆盖 6 平台 + twitter；popup 改造（打开即自动预览 + 复制 markdown 按钮 + 简洁明亮风）。
- **PR2 中文平台（易）**：知乎 + 微信公众号 adapter（纯 DOM + 懒加载图属性 + 公式）。
- **PR3 中文平台（难）+ 字幕**：小红书（MAIN world `__INITIAL_STATE__`）+ 微博 adapter；核实并按需补 B站字幕（`player/v2` 三步）。

## Technical Approach（调研后修订）

> 关键发现：**defuddle（Obsidian 官方 Web Clipper 引擎，MIT，浏览器原生）已内置 6/10 平台的 site extractor**（B站/Reddit/Medium/GitHub/YouTube含字幕/HN）+ 可替代现有 twitter。真正需要自写的只剩 4 个中文平台。

- **统一管线**：引入 `defuddle`（正文提取/清洗/标准化）+ `turndown`(+`turndown-plugin-gfm`)（HTML→Markdown）。defuddle 内部即用 turndown，二者同源、风格一致；defuddle 还能抽 schema.org 元数据直接喂 frontmatter。放弃原计划的 Readability（defuddle 更强且自带平台 extractor）。
- **每平台独立 adapter + 路由器**（已与用户确认的架构）：`lib/adapters/<platform>.ts` 导出 `matches(url)` + `extract()`；新增注册表按序匹配，命中专门 adapter 否则回退 defuddle 通用提取；替换 `content.ts` 硬编码三元判断。
  - 6 个已覆盖平台 + 通用页：直接交给 defuddle（必要时 adapter 仅做轻量包装/补字段）。
  - 4 个中文平台：自写 adapter「选正文根节点 + 去噪 + 取真实图链」→ 统一 turndown。
- **中文平台抽取要点**（详见 research）：
  - 知乎：正文 `.RichText`/`.Post-RichTextContainer`；懒加载图 `data-actualsrc→data-original→src`；公式读 `span.ztext-math[data-tex]`；先点「展开全文」+ 滚动。
  - 微信公众号：正文 `#js_content`；图 `data-src→src`（无需滚动）；标题 `#activity-name`、公众号 `#js_name`。最简单稳定。
  - 小红书：**不硬抓 DOM**，注入 MAIN world 读 `window.__INITIAL_STATE__`（或拦截页面 XHR）取 title/desc/imageList；强依赖登录态；不自建 API 签名（易封号）。
  - 微博：单条正文 + 图片（m.weibo.cn DOM 较稳）。
- **视频字幕**：YouTube 走 defuddle 的 youtube extractor（含 transcript，PO Token 失败时回退 DOM 面板）。B站字幕需核实 defuddle bilibili extractor 是否抓；若没抓，补 `view→player/v2→subtitle_url` 三步（content script 带登录 cookie fetch，需 `host_permissions: api.bilibili.com`）。
- **popup 流程**：打开即自动抽取 → markdown 预览区（可滚动）→ 核对/写备注 → 点「剪藏」保存；另有「复制 markdown」按钮（完整含 frontmatter，与写入一致）。
- **UI 风格**：简洁明亮风（白底、细腻间距、中性色），现代精致。
- **配置**：维持 `.env.local` 编译期注入，不加运行时设置页。

## Research References

- [`research/generic-clipping-stack.md`](research/generic-clipping-stack.md) — defuddle+turndown 为推荐栈，defuddle 内置覆盖 6/10 平台，仅 4 个中文平台需自写。
- [`research/english-platforms.md`](research/english-platforms.md) — Reddit `.json`、HN Algolia 整树、GitHub raw md API、Medium Readability、YouTube 字幕双路线(API+DOM 回退) 的实现细节（均可作 defuddle 不足时的备选）。
- [`research/chinese-platforms.md`](research/chinese-platforms.md) — 知乎/微信 DOM 选择器与懒加载图属性、小红书 MAIN world `__INITIAL_STATE__`、B站字幕 `player/v2` 三步流程与坑点。

## Technical Notes

- adapter 注册点在 `content.ts`，目前是硬编码 `twitter.matches(url) ? twitter : generic`，多 adapter 需要一个路由机制。
- markdown 模板单一（`normalize.toMarkdown`），不同平台是否需要差异化 frontmatter/正文结构待定。
