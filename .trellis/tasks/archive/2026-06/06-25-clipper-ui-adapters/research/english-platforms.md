# Research: 英文平台抽取策略（Reddit / Medium / GitHub / Hacker News / YouTube）

- **Query**: 为 Obsidian 网页剪藏扩展（WXT + TS, Chrome MV3, content script）调研 5 个英文平台的最干净正文/评论/字幕抽取方式，含开源参考、选择器、API、坑点；优先纯前端 content script 方案。
- **Scope**: external（含可借鉴开源 repo）
- **Date**: 2026-06-25

---

## 总览结论（按平台推荐方案）

| 平台 | 首选方案 | 备选 | content script 纯前端可行？ |
|---|---|---|---|
| Reddit | `url + ".json"` 公共 JSON 端点 | old.reddit DOM / shreddit DOM | ✅（同源 fetch，带 UA） |
| Medium | Mozilla Readability.js 跑在抓到的 DOM 上 | `<article>` + canonical 元数据 | ✅（页面内直接解析 document） |
| GitHub | REST/GraphQL API 取 raw markdown | `.markdown-body` DOM | ✅（API 同样可在扩展里 fetch） |
| Hacker News | Algolia `items/:id` 一次拿整棵评论树 | Firebase v0（仅返回子 ID） | ✅（公共 API，无 key、无 CORS 限制） |
| YouTube | 读 `ytInitialPlayerResponse` → timedtext `&fmt=json3`；失败回退 DOM transcript 面板 | DOM `#segments-container` 抓取 | ✅ 但有 PO Token 坑（见下） |

---

## 1. Reddit

### 推荐抽取方式
**首选：`<任意 Reddit URL> + ".json"` 公共 JSON 端点**（非官方但稳定，old.reddit 也用它加载）。在 content script 里同源 fetch 即可，无需 OAuth/无 CORS 问题。

- 帖子+评论树：`https://www.reddit.com/r/<sub>/comments/<id>.json`
  - 返回是一个**长度为 2 的数组**：`[postListing, commentListing]`
  - `data[0].data.children[0].data` = 帖子正文（`title`, `selftext`（markdown 原文）, `selftext_html`, `author`, `score`, `created_utc`, `url`）
  - `data[1].data.children[]` = 顶层评论，每个 `.data.body`（markdown 原文）/`.data.body_html`、`.data.replies` 递归嵌套、`.data.score`
- 可用查询参数：`?limit=100`、`?depth=N`、`?sort=top|confidence|new`、`?raw_json=1`（避免 `&lt;` 等 HTML 实体转义，**强烈建议加**）

### 关键选择器 / 接口
- JSON 字段：`selftext`（帖子 md 原文）、`body`（评论 md 原文）→ 直接就是 markdown，几乎零清洗。
- DOM 回退（JSON 被限流时）：
  - **old.reddit.com**：正文 `.expando .md`，评论 `.commentarea .entry .md`，分数 `.score.unvoted`。结构最干净、最适合 fallback。
  - **new reddit（shreddit Web Components）**：正文 `shreddit-post` 下 `[slot="text-body"]` / `div[id$="-post-rtjson-content"]`；评论 `shreddit-comment` 自定义元素，正文在 `div[slot="comment"]`。SPA + 自定义元素，较难，优先用 JSON。

### 可借鉴开源 repo
- **obsidianmd/obsidian-clipper**（官方 Web Clipper，MIT，~5k★，活跃）— 可参考其平台解析思路。
- **snoowrap**（JS Reddit API 包装，MIT，~1k★，维护放缓）— 走 OAuth，了解数据结构有用，但本扩展不需要 OAuth。
- DEV/Clura/logiover 等 2026 文章一致确认 `.json` 端点仍可用。

### 坑点
- **必须带描述性 `User-Agent`**（如 `obsidian-wiki-clipper/1.0`），否则直接 429。注意：MV3 content script 里 `fetch` 的 UA 不能随意改（受浏览器限制），可改用 background service worker + `declarativeNetRequest` 改 header，或直接用浏览器默认 UA（多数情况可用）。
- **限流**：未认证约 ~30–60 req/min/IP，超过得 soft 429 带 `Retry-After`，尊重退避即可，不会永久封。剪藏单页场景几乎不会触发。
- **评论树截断**：深层回复会被 `kind: "more"` 桩替代，默认只给前 ~200 条。剪藏「顶楼/高赞」场景通常 `depth=2~3` + `sort=top` 就够；要全量需递归 `/api/morechildren`（无 OAuth 受限）。
- `.json` 是**非官方**端点，可能无预告变更——建议保留 old.reddit DOM 作为 fallback。

---

## 2. Medium

### 推荐抽取方式
**首选：Mozilla Readability.js**（11.2k★，Apache-2.0，Firefox Reader View 同款算法，2026-01 仍活跃）。content script 里可直接对当前 `document`（或克隆节点）跑：

```js
import { Readability } from '@mozilla/readability';
const docClone = document.cloneNode(true);
const article = new Readability(docClone).parse();
// article.title / .content(HTML) / .textContent / .byline / .siteName / .publishedTime / .excerpt
```
再用 turndown 之类把 `article.content` 转 markdown。注意 Readability 输出未净化，untrusted 输入建议配 **DOMPurify** 再转换。

### 关键选择器 / 接口
- Medium 正文容器：`article`，正文段落集中在 `article section` 内；标题 `h1`。
- **canonical**：`<link rel="canonical" href="...">`（Medium 自定义域名/`*.medium.com` 都有，用它做去重和真实 URL）。
- 元数据走 OpenGraph：`meta[property="og:title"]`、`meta[property="article:published_time"]`、`meta[name="author"]`。

### 付费墙
- Medium 是**计量付费墙（metered）**，星标会员文章超额后锁定。Medium **会把全文先渲染进页面 HTML 再叠加遮罩层**，所以 Reader 模式（Readability）常能在遮罩出现前拿到完整正文——这是“顺带”能拿到，并非专门绕墙工具，不保证 100%。
- 合规绕墙靠作者的 **friend link**（`?source=friends_link&sk=...`），不是程序能生成的。
- 不建议在扩展里集成专门绕付费墙逻辑（合规风险）；以「能抽到就抽，抽不到给出 canonical + 摘要」为度。

### 可借鉴开源 repo
- **mozilla/readability**（核心库，首选依赖）。
- **obsidianmd/obsidian-clipper** 的 Reader 功能即基于通用正文提取，可对照其对 `article` 的处理。

### 坑点
- Medium 大量懒加载图片用 `<img>` 的 `src` 占位 + 真实地址在 `srcset`/`data-*`；抽图片时取最高分辨率 `srcset` 项或 `og:image`。
- 自定义域名文章（很多）DOM 与 `medium.com` 基本一致，靠 canonical 判定是否 Medium。

---

## 3. GitHub

### 推荐抽取方式
**首选：走 API 拿 raw markdown，而非解析渲染 DOM**（更干净、稳定、可拿到原始 md）。三类内容：

- **README / 仓库内 .md 文件**：
  - REST：`GET /repos/{owner}/{repo}/readme`，加 header `Accept: application/vnd.github.raw`（直接返回原始 markdown 文本）。
  - 或直接 `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md`（无需 token，最简单）。
- **Issue 正文**：`GET /repos/{owner}/{repo}/issues/{n}`，header `Accept: application/vnd.github.raw+json` → 响应 `body` 即 markdown 原文（`.text+json` 给纯文本、`.html+json` 给渲染 HTML、`.full+json` 全给）。评论：`GET /repos/{owner}/{repo}/issues/{n}/comments`。
- **Discussion 正文/回复**：REST 无单独端点，用 **GraphQL**：`repository.discussion(number:).body`（md 原文）+ `comments`。需要 token（GraphQL 必须认证）。

### 关键选择器 / 接口
- API 字段：Issue/Discussion 的 `body` = markdown 原文（GraphQL 同名 `body` 为 Markdown，`bodyHTML` 为渲染 HTML）。
- DOM 回退（不想用 token 时）：渲染正文统一在 `article.markdown-body` / `.markdown-body`；Issue 首帖在 `.js-comment-container .comment-body`；README 在仓库首页 `article.markdown-body`。

### 走 API 还是 DOM？
- README/Issue：**优先 raw markdown API**（匿名即可，无需 token，60 req/h 未认证限额对剪藏足够；带 PAT 提到 5000/h）。拿到的就是源 markdown，无需 HTML→md 转换、无渲染噪音。
- Discussion：GraphQL 需 token；若不想引入 token，回退 `.markdown-body` DOM + turndown。

### 可借鉴开源 repo
- **octokit/octokit.js**（官方 JS SDK，MIT，活跃）— REST+GraphQL 封装。
- GitHub Docs 明确支持 `vnd.github.raw+json` 媒体类型取 issue 原始 md（已确认）。

### 坑点
- 未认证 REST 限额 60 req/h/IP；GraphQL 必须 token。剪藏单页 OK，批量需 token。
- GitHub 页面是部分 SPA（Turbo/PJAX 导航），DOM 抓取要等内容稳定；API 路线绕开此问题。
- 私有仓库必须 token。raw.githubusercontent 仅公开仓库匿名可取。

---

## 4. Hacker News

### 推荐抽取方式
**首选：Algolia `items/:id`，一次请求拿整棵评论树**（公共、无 key、无 CORS 限制、无明确 rate limit）。

- `GET https://hn.algolia.com/api/v1/items/{id}`
  - 返回对象含 `title`, `url`, `author`, `points`, `text`（HTML），以及 `children[]` **递归嵌套的完整评论树**（每个 child：`id`, `author`, `text`(HTML), `points`, `created_at`, `children`）。
  - 这是相对 Firebase 的最大优势：**单次请求即整线程**，无需 N+1 递归。

### 备选：官方 Firebase v0
- `GET https://hacker-news.firebaseio.com/v0/item/{id}.json` → 返回 `kids`（**只是子评论 ID 数组**，需对每个 ID 再请求，200 条评论=200 次请求）。
- 优势：实时/权威（Algolia 索引有 1–2 分钟延迟）。剪藏对实时性不敏感，故选 Algolia。

### 关键选择器 / 接口
- 从页面 URL `news.ycombinator.com/item?id=XXXX` 取 `id`，喂给 Algolia。
- 字段：story `text`/`title`/`url`；comment `text`（HTML 需 unescape + strip tags 转 md）。
- DOM 回退（极少需要）：评论行 `.comtr`，正文 `.commtext`，story 标题 `.titleline > a`。

### 可借鉴开源 repo
- **HackerNews/API**（官方 Firebase API 文档，权威）。
- Algolia HN Search 公共文档 `hn.algolia.com/api`；Simon Willison TIL 演示 `items/:id` 整树用法（已确认）。

### 坑点
- Algolia 索引延迟 1–2 分钟（刚发的帖可能查不到，回退 Firebase）。
- `text` 字段是 HTML（含 `<p>`、HTML 实体），需 unescape 再转 markdown。
- 评论树可任意深，渲染 markdown 时注意层级缩进/折叠死评论（`text` 为空/已删）。

---

## 5. YouTube（重点：字幕能否在扩展里拿、怎么拿）

### 标题/简介
- 读页面全局变量 `ytInitialPlayerResponse.videoDetails`：`title`, `shortDescription`, `author`, `lengthSeconds`(字符串), `viewCount`, `videoId`。
- 或 OG 元数据 `meta[property="og:title"]` / `meta[name="description"]`。

### 字幕 transcript —— 能拿，但有两条路线，各有坑

#### 路线 A：`ytInitialPlayerResponse` + timedtext `&fmt=json3`（首选，纯前端）
1. content script 读 `window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[]`。
2. 每个 track 有 `baseUrl`（**已签名**）、`languageCode`、`kind`（`asr`=自动生成）、`name`、`isTranslatable`。
3. 取目标语言 track，**先剥离已有 `fmt` 参数再追加 `&fmt=json3`**（ANDROID 客户端 URL 自带 `&fmt=srv3`，不剥离会被忽略并返回 XML）。
4. 同源 `fetch(baseUrl + '&fmt=json3')` → 解析 `events[].segs[].utf8` 拼接，`tStartMs` 为时间戳。
   - 因为 content script 跑在 youtube.com 上，**同源、无 CORS 问题**，且 baseUrl 已带签名。

> ⚠️ **PO Token 坑（2025–2026 关键变化）**：当 `baseUrl` 含 `&exp=xpe` 时，timedtext 端点对**任何程序化请求返回 HTTP 200 但空 body**——即使带登录 cookie 也没用。原因：YouTube 现在要求 `&pot=<PoToken>`，这是 YouTube 播放器 JS 运行时用 BotGuard 生成的加密 proof-of-origin token，**不是 cookie，无法手动构造**。这已让 `jdepoix/youtube-transcript-api`（8k★）等纷纷抛 `PoTokenRequired`。
> - 含 `&exp=xpe` 的 track ⇒ 路线 A 大概率拿到空 body，**必须回退路线 B**。
> - baseUrl 签名有时效（~6 小时），拿到后尽快 fetch，别长期缓存。

#### 路线 B：DOM transcript 面板抓取（回退，最稳，Obsidian 官方采用）
YouTube「Show transcript / 显示转写」面板展开后才把 segments 渲染进 DOM，content script 读取即可（**完全绕开 timedtext/PO Token**）：

1. 确保面板已展开（用户已点开，或脚本点击 `[aria-label="Show transcript"]` / `...more` 展开简介后的转写按钮，等待面板挂载）。
2. 容器：`ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]` 内的 `#segments-container`。
3. 逐条：`ytd-transcript-segment-renderer`，时间戳 `.segment-timestamp`，文本 `.segment-text`（2026 年文本已迁到 `.segment-text`，旧的 `span.yt-core-attributed-string` / `PAmodern_transcript_view` 已失效）。
4. 长视频需在容器内 `scrollTop = scrollHeight` 自动滚动，直到 segment 数量不再增长（懒加载）。

> kepano（Obsidian）在 Obsidian Web Clipper 中即用此 DOM 方案；社区模板示例：
> `{{selectorHtml:ytd-engagement-panel-section-list-renderer[visibility$="EXPANDED"] #segments-container|strip_tags:"h2,ytd-transcript-segment-renderer"|...|markdown}}`
> 缺点：YouTube 频繁改版，选择器易碎（2026-02/03 已变过两次），需准备多套选择器并容错。

#### 推荐组合（content script）
**先试路线 A**（无 `&exp=xpe` 时最干净、含精确时间戳、可选语言）；**检测到空 body 或 `&exp=xpe` 时回退路线 B**（DOM 面板）。两者都纯前端、无需后端代理。

### 关键接口/选择器小抄
- 播放器数据：`ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[].baseUrl`
- transcript 格式：`baseUrl.replace(/&fmt=\w+/,'') + '&fmt=json3'` → `events[].segs[].utf8`
- DOM：`#segments-container ytd-transcript-segment-renderer`（`.segment-timestamp` + `.segment-text`）

### 可借鉴开源 repo
| repo | 说明 | star/活跃 | license |
|---|---|---|---|
| **obsidianmd/obsidian-clipper** | 官方 Web Clipper，Reader 内置 YT transcript（DOM 路线，kepano 维护） | ~5k★ 活跃 | MIT |
| **ericmmartin/youtube-transcript-plus** | Node 库，封装 video/player/transcript 三段 fetch，可注入自定义 fetch；2.0.0(2026-03) | 152★ / 16.6k 周下载 | MIT |
| **jdepoix/youtube-transcript-api** | Python，最知名 transcript 库；已加 `PoTokenRequired` 异常 | 8k★ 活跃 | MIT |
| **reza-nzri/yt-dual-sub** | 浏览器扩展示例：page-bridge 读 `ytInitialPlayerResponse` + timedtext json3 + cue parser | 小众 | - |
| **nadimtuhin/ytranscript** | 文档清晰说明 innertube/`ytInitialPlayerResponse` 双路径与 `fmt=srv3→json3` 剥离坑 | 小众 | - |

### 坑点汇总
- **PO Token**：路线 A 对部分视频（`&exp=xpe`）必失败，务必有 DOM 回退。
- **SPA 导航**：YouTube 是单页应用，切视频不刷新页面，`ytInitialPlayerResponse` 可能是旧视频的——需校验 `.videoDetails.videoId === 当前URL的v`，不一致则重新 `fetch('/watch?v=ID')` 解析 HTML 里的 `ytInitialPlayerResponse`。
- **签名时效**：baseUrl ~6h 过期，别缓存。
- **DOM 易碎**：选择器随改版变化（已多次），准备多套 + 优雅降级。
- **无字幕视频**：`captions` 字段缺失即该视频无字幕（含无自动字幕）。

---

## Caveats / Not Found

- 各开源 repo 的 star 数为本次检索时点（2026-06）的网络结果，可能有波动。
- Reddit `.json`、YouTube timedtext 均为**非官方端点**，YouTube PO Token 机制仍在演进，路线 A 的可用比例可能继续下降——架构上务必把「API/JSON 路线」与「DOM 路线」做成可切换的 fallback。
- MV3 content script 修改请求 `User-Agent`（Reddit 需要）受限，落地时需验证是否要 background + `declarativeNetRequest`，本次未深入实测。
- 未实测各选择器在当前 YouTube/Reddit 线上 DOM 的最新有效性（截至社区反馈 2026-03 的选择器为准）。
