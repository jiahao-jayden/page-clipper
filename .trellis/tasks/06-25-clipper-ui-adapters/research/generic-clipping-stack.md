# Research: 通用网页剪藏技术栈（正文提取 + HTML→Markdown + 分站点模板）

- **Query**: 调研对比 obsidian-clipper / readability / turndown / defuddle / jina reader / percollate 的架构与可借鉴点，给出推荐组合与平台覆盖度
- **Scope**: external（开源项目）+ 少量 internal（本仓现状）
- **Date**: 2026-06-25

---

## TL;DR 结论

- **推荐组合：`defuddle`（正文提取/清洗/标准化）+ `turndown`（+`turndown-plugin-gfm`）（HTML→Markdown）**。
  - `defuddle` 是 Obsidian 官方 Web Clipper 的提取引擎，**纯前端、core 包零依赖、专为剪藏设计**，比 Readability 更适合，并且**内部就是用 turndown 做 markdown 转换**。
  - 统一管线与本任务 PRD 的「统一 turndown 管线 + Readability 兜底」决策一致，只是把兜底引擎从 Readability 升级为更强的 defuddle。
- **平台覆盖（关键发现）**：defuddle 内置 site-specific extractors，已**直接覆盖我们 10 个平台里的 6 个**：B站 / Reddit / Medium / GitHub / YouTube / Hacker News（YouTube 44KB、B站 15KB extractor，含视频/字幕处理）。
  - **未覆盖、需自写 adapter 的 4 个全是中文生态**：知乎 / 微信公众号 / 小红书 / 微博。
- 落地策略：6 个已覆盖平台 + 通用页直接交给 defuddle；4 个中文平台写专门 adapter「选正文根节点 + 去噪」，再走统一 turndown 管线。现有 twitter adapter 也可由 defuddle 的 twitter/x extractor 取代。

---

## Findings

### 1. obsidianmd/obsidian-clipper（官方 Obsidian Web Clipper）

- **用途**：浏览器扩展（Chrome/Firefox/Safari MV3），把网页剪藏成带模板/属性的 Obsidian 笔记；另有 CLI/API 产物。
- **license**：MIT（Copyright © 2024 Obsidian；商标/图标除外）。
- **维护活跃度**：很活跃。4.6k★、~40 贡献者、67 个 release，最新 1.7.0（2026-06）。作者 kepano 同时是 defuddle 作者。
- **架构 / 可借鉴点**（`src/utils/` 关键文件）：
  - 提取引擎已**整体外包给 `defuddle ^0.19`**（`content-extractor.ts`），自身不再直接调 turndown/readability。
  - **模板/属性系统**（这是它最值得借鉴的部分）：
    - `template-compiler.ts` + `renderer.ts`：把模板字符串编译、渲染。
    - `variables/`：`simple.ts`（`{{title}}`/`{{author}}`/`{{content}}` 等内置变量）、`selector.ts`（`{{selector:.css-path}}` 直接从页面取值）、`schema.ts`（`{{schema:@Article.author}}` 读 schema.org/JSON-LD）、`prompt.ts`（LLM 提示变量）。
    - `filters.ts` + `filters/`：管道过滤器（如 `{{title|upper}}`、日期格式化、`markdown`、`slice`、`list` 等文本变换），用于在模板里二次加工变量。
    - `interpreter.ts`（23KB）：可选的 **LLM「解释器」**，用大模型从页面抽取自定义变量（我们 Out of Scope，可忽略）。
  - **分站点规则**：不是硬编码 if/else，而是用户可配的 **template + URL 匹配（triggers）**：`triggers.ts` 让模板按 URL pattern / schema 自动选用；分站点差异主要落在「不同模板」而非「不同提取代码」。提取层的分站点逻辑全在 defuddle 的 extractors 里。
  - **frontmatter 处理**：通过模板的「note properties」生成 YAML frontmatter——每个属性是一个 `key: {{变量|过滤器}}`，渲染后序列化为 frontmatter。值类型/转义在 `obsidian-note-creator.ts` + `string-utils.ts` 处理。
  - 其他：`reader.ts`（103KB，Reader 阅读模式）、`reader-transcript.ts`（24KB，视频字幕/transcript 抓取）、`flatten-shadow-dom.ts`（拍平 shadow DOM，便于提取）、`dom-utils.ts`、用 `dompurify` 做净化、`highlight.js` 做代码高亮、`dayjs` 处理日期。
- **对我们的启示**：模板/属性/过滤器的「变量 + 过滤器管道」抽象很值得借鉴，但本任务 PRD 已决定「统一 frontmatter、不做模板系统、不做 LLM」，所以**重点借鉴它的提取分层（defuddle）与 frontmatter 字段映射思路，而非整套模板引擎**。

### 2. mozilla/readability（Readability.js）

- **用途**：Firefox 阅读模式的独立正文提取库；`new Readability(document).parse()` 返回 `title/content(HTML)/textContent/excerpt/byline/siteName/lang/publishedTime` 等。
- **能否在 content script 直接用**：✅ 纯前端可用（浏览器里直接传 `document`）。建议传 `document.cloneNode(true)`，因为 `parse()` 会修改 DOM。Node 端需 jsdom。
- **license**：Apache-2.0。
- **维护活跃度**：活跃、成熟稳定（11k★，Mozilla 官方维护）。
- **保留图片/代码块/列表**：返回的是「正文 HTML 串」，保留段落/列表/图片/链接等结构；但它**面向「文章」**，对代码块语言、脚注、数学公式等没有标准化，社交/SPA/非文章页面（推文、论坛、视频页）效果差。
- **局限**：评分式启发算法对非典型文章召回差；不抽取 schema.org 之外的结构化数据；输出 HTML 仍需再接一个 HTML→MD 转换器。
- **定位**：可作为 defuddle 的**二级兜底**，但 defuddle 已能替代它，单独引入价值不大。

### 3. mixmark-io/turndown（HTML→Markdown）

- **用途**：把 HTML（字符串或 DOM 节点）转 Markdown。`new TurndownService(opts).turndown(node)`。
- **能否在 content script 直接用**：✅ 纯前端可用，可直接传 DOM 节点（`turndown(document.getElementById('content'))`），无需 Node。
- **license**：MIT。
- **维护活跃度**：事实标准（11k★），稳定。最新 7.2.x。
- **配置 / 插件**：
  - 选项：`headingStyle: 'atx'`、`codeBlockStyle: 'fenced'`、`bulletListMarker`、`emDelimiter`、`linkStyle` 等。
  - `addRule()` 自定义规则、`keep()`/`remove()` 保留/删除标签、`use(plugin)` 用插件。
  - **GFM**：`turndown-plugin-gfm` 提供**表格、删除线、任务列表 (`- [ ]`)**；自动链接等。
  - **代码块**：设 `codeBlockStyle:'fenced'` 输出 ``` 围栏；语言可通过自定义规则从 `class="language-xxx"`/`data-lang` 提取（与 defuddle 的代码块标准化天然配合）。
  - **图片**：默认保留为 `![alt](src)`（符合 PRD「保留图链不下载」）；可加规则把相对 URL 补全为绝对 URL。
  - 注意：转义较激进（防止把正文里的 `1.`、`#` 误当 markdown），必要时可覆盖 `TurndownService.prototype.escape`。

### 4. kepano/defuddle（独立正文提取库）

- **用途**：输入 URL 或 HTML/`document`，输出清洗后的 HTML 或 Markdown + 丰富元数据。**为 obsidian-clipper 而生**，但可在任何环境运行。
- **能否在 content script 直接用**：✅✅ **浏览器一等公民**。`new Defuddle(document).parse()`；**core 包零运行时依赖**（CLI 才需 commander）。三个 bundle：
  - `defuddle`（core，浏览器推荐，无依赖，处理 math 但不含 MathML↔LaTeX 回退）；
  - `defuddle/full`（额外含 **Markdown 转换** + 数学公式，内部依赖 `turndown`）；
  - `defuddle/node`（Node，配 linkedom/jsdom）。
  - 关键：`turndown` 是 defuddle 的 **optionalDependency**——即 **defuddle 的 markdown 输出就是用 turndown 实现的**，二者天然同源。
- **license**：MIT。
- **维护活跃度**：活跃（8.2k★，kepano 主导），但 README 自述 **"very much a work in progress"** → 需锁版本。当前 0.19.x。
- **与 Readability 的差异（README 明示）**：
  - 更宽容，少误删不确定元素（召回更高）；
  - 对脚注、数学、代码块输出**一致标准化**；
  - 借助页面「移动端样式」猜测无用元素；
  - 抽取更多元数据，**含 schema.org / JSON-LD**（`author/published/description/image/site/favicon/lang/wordCount/...`）→ 直接喂 frontmatter。
  - **site-specific extractors**（见第 6 节），Readability 完全没有。
- **保留图片/代码块/列表**：✅ 全部支持，且做了**标准化**：
  - 代码块：去行号/高亮、保留语言到 `data-lang`/`class`；
  - 脚注/inline reference：统一格式；
  - callout/alert（GitHub alerts、Bootstrap alert 等）→ Obsidian 风格 `> [!info]` callout（对 Obsidian 极友好）；
  - 标题：首个与标题重复的 H1/H2 去除、H1→H2、去锚点。
  - 选项可控：`removeImages`、`removeExactSelectors`、`removePartialSelectors`、`removeHiddenElements`、`removeLowScoring`、`removeSmallImages`、`contentSelector`（绕过自动检测，指定正文根）、`markdown`/`separateMarkdown` 等。

### 5. 其他方案（简要）

- **jina-ai/reader（r.jina.ai）**：URL→LLM 友好 markdown 的**服务端方案**（前缀 `https://r.jina.ai/<url>`，亦可 `docker pull ghcr.io/jina-ai/reader:oss` 自托管）。Apache-2.0，11k★，活跃。引擎=puppeteer/curl-impersonate，格式化 profile 含 `@mozilla/readability`、自研 `markify` 规则引擎、`ReaderLM v2` 大模型；支持 PDF（PDF.js）。**不可嵌入 content script**（依赖 headless Chrome + LibreOffice + CJK 字体），但**对抓不到/SPA 页面可作为可选远程兜底 API**（注意隐私：把 URL 发给第三方）。
- **percollate**（danburzo/percollate）：**Node CLI**，puppeteer + Readability，输出 PDF/EPUB/HTML/Markdown，MIT。纯 CLI、非浏览器，**不适用**于扩展运行时；其「Readability→单一中间 HTML→多格式」管线思路可参考。
- 其余同类（`html-to-md`、`node-html-markdown`、`mdream` 等）相对 turndown 生态弱、插件少，无明显优势，不建议替换 turndown。

---

## 推荐组合与理由

**正文提取：`defuddle`　|　HTML→Markdown：`turndown` + `turndown-plugin-gfm`**

1. **defuddle 优于 Readability**：浏览器原生、core 零依赖、专为剪藏；对代码块/脚注/数学/callout 做标准化；抽 schema.org 元数据直接喂 frontmatter；**自带 6 个目标平台的 site extractor**。Readability 仅适合「文章」，社交/视频/论坛召回差。
2. **turndown 做统一 HTML→MD**：事实标准、纯前端、GFM 插件覆盖表格/删除线/任务列表、围栏代码块 + 语言、图片保留为 markdown 图链——完全满足 PRD「保留标题/段落/代码块/列表/图片」。
3. **二者同源**：defuddle 的 markdown 转换本就用 turndown，组合无缝、风格一致。
- **两种集成姿势**（择一，建议 A）：
  - **A（推荐，贴合 PRD「统一 turndown 管线」）**：各 adapter 负责「选正文根 DOM + 去噪」→ 交给**统一的 turndown 实例**转 MD；通用页/已覆盖平台用 defuddle 提取（可用 `separateMarkdown` 拿 HTML 再过我们自己的 turndown，保证全站 markdown 风格统一）。
  - **B（最省事）**：通用页/已覆盖平台直接 `defuddle/full` 的 `markdown:true` 一步出 MD；仅 4 个中文平台自写 adapter + turndown。代价是两条 MD 管线风格可能略有差异。
- **Readability**：可不引入；若要双保险，作为 defuddle 之后的二级兜底。

---

## 平台覆盖度（针对我们 10 个目标平台）

defuddle `src/extractors/` 现有：`bilibili, bluesky, c2-wiki, chatgpt, claude, discourse, gemini, github, grok, hackernews, leetcode, linkedin, lwn, mastodon, medium, nytimes, reddit, substack, threads, twitter, wikipedia, x-article, x-oembed, youtube`（+ `_base`/`_conversation` 基类）。

| 平台 | defuddle 覆盖 | 程度 / 备注 |
|---|---|---|
| B站 Bilibili | ✅ `bilibili.ts`（15KB） | 体量大，含视频信息处理；字幕需核实，可能需补 |
| Reddit | ✅ `reddit.ts` | 帖子/讨论（`_conversation` 基类） |
| Medium | ✅ `medium.ts` | 文章正文 |
| GitHub | ✅ `github.ts`（10KB） | README/issue/代码页 |
| YouTube | ✅ `youtube.ts`（44KB） | 体量最大，含 **transcript/字幕**抓取（配合 clipper `reader-transcript.ts`） |
| Hacker News | ✅ `hackernews.ts`（9.5KB） | 评论树/讨论 |
| 知乎 Zhihu | ❌ 无 | **需自写 adapter** |
| 微信公众号 | ❌ 无 | **需自写 adapter** |
| 小红书 RED | ❌ 无 | **需自写 adapter** |
| 微博 Weibo | ❌ 无 | **需自写 adapter** |

- **结论**：直接复用 defuddle 即覆盖 **6/10**（且包含视频字幕路线）；**仅 4 个中文平台需要我们自写专门 adapter**——与 PRD 的「每平台 adapter + 路由器」完全契合，且工作量比预期小很多（中文 4 家 + 复用现有 twitter 逻辑或换 defuddle）。
- 额外红利：defuddle 还顺带覆盖 Substack/LinkedIn/Mastodon/Bluesky/NYTimes/ChatGPT/Claude/Wikipedia 等，未来可零成本扩展。

---

## Caveats / Not Found

- **defuddle 自述 WIP**：API/输出可能变动，**务必锁定版本**（如 `defuddle@0.19.x`）并在升级时回归。
- **B站字幕**未逐行确认 `bilibili.ts` 是否已抓字幕；YouTube 字幕在 `youtube.ts`/`reader-transcript.ts` 基本确定支持。落地前建议读这两个 extractor 验证字幕字段。
- **中文平台反爬/登录态/SPA**：知乎/微信/小红书/微博 正文常在登录态或动态渲染下，content script 在已打开页面里能拿到 DOM 通常没问题，但小红书/微博 图片有防盗链（`referrerPolicy`），markdown 图链可能在 Obsidian 侧加载失败——属于「仅存图链」的已知限制。
- **bundle 选择**：浏览器用 `defuddle`(core) 或 `defuddle/full`；若走推荐姿势 A（自己用 turndown），core 即可，再单独装 `turndown` + `turndown-plugin-gfm`。
- 未深读各 extractor 源码内部实现（仅依据目录/体量/README）；如需精确字段映射，下一步可逐个 Read `defuddle/src/extractors/<platform>.ts`。

## External References

- obsidian-clipper（MIT，提取=defuddle，模板/属性/过滤器系统）：https://github.com/obsidianmd/obsidian-clipper
- defuddle（MIT，浏览器原生正文提取，内置 site extractors + turndown markdown）：https://github.com/kepano/defuddle
- turndown（MIT，HTML→MD）+ turndown-plugin-gfm：https://github.com/mixmark-io/turndown
- @mozilla/readability（Apache-2.0，文章正文提取）：https://github.com/mozilla/readability
- jina-ai/reader（Apache-2.0，服务端 URL→markdown，可自托管，不可嵌扩展）：https://github.com/jina-ai/reader
- percollate（MIT，Node CLI，puppeteer+Readability→PDF/EPUB/MD）：https://github.com/danburzo/percollate
