# Research: 中文平台专用 adapter（知乎 / 微信公众号 / 小红书 / B站）

- **Query**: content script 内对 4 个中文平台最干净的正文/图片/字幕抽取方式
- **Scope**: external（开源 repo + 油猴脚本 + 官方 API 文档）
- **Date**: 2026-06-25

> 适用前提：WXT content script（MV3，运行在 isolated world）。涉及读取页面 `window.__INITIAL_STATE__` 等全局变量时，必须注入 `<script>` 到 **MAIN world**（或 `world: 'MAIN'`），isolated world 读不到。跨域 `fetch` 需在 `host_permissions` 声明对应域名，并依赖浏览器自动带 cookie（`credentials: 'include'`）。

---

## 1. 知乎 zhihu.com

**推荐抽取方式**：直接抓 DOM 正文根节点（`.RichText` / `.RichContent`），用 turndown 转 markdown。先点开「展开全文」并滚动触发懒加载，再读图片真实属性。

**正文根节点选择器**（三种页面类型）：
| 类型 | URL 特征 | 正文根节点 |
|---|---|---|
| 回答 answer | `www.zhihu.com/question/*/answer/*` | `.AnswerCard .RichContent-inner .RichText`（或回答内 `.ContentItem .RichText`） |
| 专栏文章 | `zhuanlan.zhihu.com/p/*` | `.Post-RichTextContainer .RichText`（标题 `.Post-Title`，作者 `.AuthorInfo`） |
| 想法 pin | `www.zhihu.com/pin/*` | `.PinItem .RichText`，图片在 `.Image-PreviewVague > img` |
| 折叠展开按钮 | — | `.RichContent.is-collapsed .ContentItem-more`（先点击再抽取） |

**懒加载图片真实地址（优先级）**：`data-actualsrc` → `data-original` → `src`（`src` 常为 svg 占位）。GIF 与高清：把 URL 里 `_r.jpg` 替换成 `_1440w.jpg`。无水印原图思路：用 `data-original-token` 文件名替换 `src` 文件名。`<figure><noscript>` 内也藏有 `<img data-original>` 兜底。
- 取值参考函数 `getRealImageUrl`：`data-actualsrc` → `data-original` → `src`（排除 `data:image/svg+xml`）→ 兜底读 `figure noscript` 内 img。

**代码块与公式**：代码块在 `.highlight pre`（或 `pre code`），turndown 配 `turndown-plugin-gfm` 即可。公式：知乎用 `<span class="ztext-math" data-tex="...">`，真实 LaTeX 在 **`data-tex`** 属性里（页面渲染成 SVG/图片），抽取时读 `data-tex` 包成 `$...$`，否则会丢失。

**可借鉴开源 / 油猴**：
- [Howardzhangdqs/zhihu-copy-as-markdown](https://github.com/Howardzhangdqs/zhihu-copy-as-markdown)（一键复制为 Markdown，含 Lex→Parser 思路，最值得抄）
- [qtqz/zhihu-backup-collect](https://github.com/qtqz/zhihu-backup-collect)（回答/文章/想法 → md/zip，兼容 Obsidian）
- [mayooot/zhihu-hd-image-extractor](https://github.com/mayooot/zhihu-hd-image-extractor)（懒加载图自动滚动 + `data-original/data-actualsrc` 提取）
- [zhihu to telegraph gist](https://gist.github.com/welann/e408ff156c9b1395c4de032543442101)（`getRealImageUrl` 实现 + figure/pin 分支）

**坑点**：① 前端类名常变（`.RichText` 相对稳定，外层容器易变）。② 图片懒加载未触发则只有占位 svg，需先滚动。③ 图床防盗链：`pic*.zhimg.com` 带 `Referer` 校验，转存需去 referer 或设 `Referer: https://www.zhihu.com/`。④ 部分回答需登录/反爬验证（出现 `unhuman` 验证页）。⑤ SPA：切换回答不刷新 URL，需监听 DOM 变化。

---

## 2. 微信公众号 mp.weixin.qq.com

**推荐抽取方式**：最简单稳定。正文容器固定 `#js_content`，先 JS 注入把所有 `img` 的 `data-src` → `src`（无需滚动），再用 turndown 转 markdown。

**关键选择器**：
| 字段 | 选择器 |
|---|---|
| 正文 | `#js_content`（兜底 `#js_article`） |
| 标题 | `#activity-name`（h1，需 trim） |
| 公众号名 | `#js_name` |
| 作者 | `#js_author_name`（不一定存在；元信息也可读 `#meta_content`） |
| 发布时间 | `#publish_time`（JS 渲染，可能需等渲染；或读页面 `var ct =`/`createTime`） |
| 摘要 | `meta[name="description"]` |

**懒加载图片真实属性**：**`data-src`**。注入脚本：
```js
document.querySelectorAll('#js_content img').forEach(img => {
  const real = img.getAttribute('data-src');
  if (real) img.src = real;
});
```
图片格式从 `?wx_fmt=jpeg` 或路径 `/mmbiz_jpg/` 推断扩展名。清理 1x1 SVG 占位、`opacity:0/visibility:hidden/display:none` 隐藏样式。

**可借鉴开源**：
- [gxcsoccer/wechat-article-crawler](https://github.com/gxcsoccer/wechat-article-crawler)（`data-src→src`、`#activity-name/#js_name/#publish_time/#js_content` 提取、带 Referer 下图绕防盗链，思路最贴合）
- [zyw-Wayne/wechat-article-down](https://github.com/zyw-Wayne/wechat-article-down)（WAIT/SCROLL/SAVE 脚本三段式）
- [joshleeeeee/mp-data-console](https://github.com/joshleeeeee/mp-data-console)（`#js_content/#js_article` + 隐藏样式清理 + 图片代理）

**坑点**：① **图片防盗链**：CDN `mmbiz.qpic.cn` 校验 `Referer`，content script 内 `<img>` 直接显示一般 OK（页面自带 referer），但**转存/下载**必须带 `Referer: https://mp.weixin.qq.com/` 或在后端去 referer。② 发布时间是 JS 注入的，DOM ready 不一定有，需等待或读内联脚本变量。③ 极少数文章是「图片消息/视频消息」无 `#js_content`。④ 分享卡/付费内容正文为空。

---

## 3. 小红书 xiaohongshu.com

**推荐抽取方式**：**不要硬抓 DOM**（虚拟滚动 + 类名混淆 + 内容截断）。最干净是读页面全局态 `window.__INITIAL_STATE__`（注入 MAIN world 脚本读取），里面有当前笔记的标题/正文/图集/视频直链。其次是拦截页面自身发出的 `/api/sns/web/v1/feed`（详情）/`user_posted`（列表）XHR 响应 JSON。

**笔记正文/图片来源**：
- 全局态：`window.__INITIAL_STATE__`（油猴用 `unsafeWindow` 访问；扩展需 MAIN world 注入）→ note 详情含 `title` / `desc`（正文）/ `imageList`（图集，每项 `urlDefault`）/ video 直链。
- 详情页 URL：`www.xiaohongshu.com/explore/{noteId}`（或 `/discovery/item/{noteId}`），URL 常带 `xsec_token`。
- 图片高清重构（去水印）：从 `urlDefault` 用正则取 traceId 再拼 `ci.xiaohongshu.com`：
```js
const re = /sns-webpic-qc\.xhscdn\.com\/\d+\/[0-9a-z]+\/(\S+)!/;
// → https://ci.xiaohongshu.com/${match[1]}?imageView2/format/png
```
- DOM 兜底选择器（不稳，仅补充）：标题 `#detail-title`，正文 `#detail-desc`（`.note-text`），图片 `.swiper-slide img` / `meta[name="og:image"]`。

**明确拿不到 / 受限**：
- ⚠️ **未登录**：详情正文与图集大概率拿不到（弹登录、`__INITIAL_STATE__` 内容缺失）。需用户已登录态。
- ⚠️ **反爬风控**：raw `fetch` 调 `edith.xiaohongshu.com/api/sns/web/v1/feed` 需 `X-s`/`X-t`/`x-s-common` 签名（`window._webmsxyw(path,'')` 生成），手动复刻签名月度失效、极易封号。**结论：content script 不要自己签名调 API**，只「拦截页面自己发的请求」或读全局态。
- ⚠️ host 必须是 `edith.xiaohongshu.com`（不是 `www`），相对路径 fetch 会 500。
- ⚠️ 视频/图片 CDN 有防盗链，转存需处理 referer。

**可借鉴开源 / 油猴**：
- [JHC000abc/XHS-AINexus-D](https://github.com/JHC000abc/XHS-AINexus-D)（油猴；拦截 `__INITIAL_STATE__` + API 响应，提取无水印图集/视频直链/作者/数据，最全）
- [fancyyan/xiaohongshu-content-collector](https://github.com/fancyyan/xiaohongshu-content-collector)（MV3 扩展；content script 被动拦截 API + DOM 补扫）
- [MuChengZJU/red-blue-cp devlog](https://github.com/MuChengZJU/red-blue-cp/blob/main/docs/devlog/2026-06-02-xhs-blogger-full-fetch-via-interceptor.md)（XHR 拦截器抓 `user_posted` 绕签名，零限流复盘，强烈推荐读）
- XHS-Downloader 用户脚本（`__INITIAL_STATE__` + 图片 CDN 正则重构无水印链）

---

## 4. B站 bilibili.com

### 4a. 视频页（标题/简介/UP主）
**推荐**：DOM 抽 + 元数据接口二选一。最稳是调 `web-interface/view` 接口拿结构化数据（标题/简介/UP/cid）。
- DOM 选择器：标题 `h1.video-title`（或 `.video-info-title-inner h1[title]`）；简介 `.basic-desc-info` / `.desc-info-text`（旧 `#v_desc`）；UP主 `.up-name` / `.up-info_right .username`。
- 接口（更稳）：`GET https://api.bilibili.com/x/web-interface/view?bvid={bvid}` → `data.title` / `data.desc`（简介）/ `data.owner.name`（UP）/ `data.aid` / `data.cid` / `data.pages[]`（多 P，每 P 有 cid/part）。

### 4b. 专栏文章 read/cv
- URL：`www.bilibili.com/read/cv{id}` 或 `/read/mobile?id=`。
- 正文根节点：`.article-content`（旧 `#read-article-holder` / `.article-holder`）。图片懒加载属性：**`data-src`**（CDN `i0.hdslb.com` 等），同样有 referer 防盗链。

### 4c. 视频字幕（核心）
**流程（content script 可直接 fetch，需登录态 cookie）**：
1. 拿 cid/aid/bvid：从 URL 取 `bvid`，或调 `GET https://api.bilibili.com/x/web-interface/view?bvid={bvid}` 取 `aid`/`cid`（多 P 取对应 `pages[p].cid`）；也可 `GET https://api.bilibili.com/x/player/pagelist?bvid={bvid}` 取 `cid`。
2. 取字幕列表：`GET https://api.bilibili.com/x/player/v2?aid={aid}&cid={cid}`（或 wbi 版 `https://api.bilibili.com/x/player/wbi/v2?...`）→ `data.subtitle.subtitles[]`，每项 `lan`（如 `zh-CN`/`ai-zh`）+ `subtitle_url`。
3. 取字幕内容：`subtitle_url` 常以 `//` 开头，需补 `https:` 前缀，再 `GET` 得 JSON：`body[]`，每项 `{from, to, content}`，按 `content` 拼成纯文本/带时间轴。

```js
// content script 内（依赖已登录 cookie，credentials:'include'）
const view = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {credentials:'include'}).then(r=>r.json());
const { aid, cid } = view.data;
const p = await fetch(`https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`, {credentials:'include'}).then(r=>r.json());
const subs = p.data.subtitle.subtitles;            // 未登录为 []
const pick = subs.find(s=>['zh-CN','zh','ai-zh'].includes(s.lan)) || subs[0];
const sub = await fetch('https:'+pick.subtitle_url).then(r=>r.json()); // body[].content
```

**content script 能否直接 fetch？** 能。`api.bilibili.com` 同主域 cookie 在登录态下随请求带上；MV3 需在 manifest `host_permissions` 加 `*://api.bilibili.com/*`、`*://*.hdslb.com/*`。`subtitle_url` 在 `*.hdslb.com` / `aisubtitle.hdslb.com`，CORS 通常允许。

**坑点**：① **字幕必须登录**（带 `SESSDATA` cookie），否则 `data.subtitle.subtitles` 为 `[]`（`allow_submit:false, list:[]`）。② wbi 接口（`player/wbi/v2`）需 `w_rid`+`wts` 签名（wbi 算法，img_key/sub_key 取自 `nav` 接口）；**普通 `player/v2` 不需签名**，优先用它省事。③ 很多视频只有 AI 字幕（`lan: ai-zh`），质量一般；无人工字幕时回退 AI。④ 多 P/合集要选对 cid。⑤ 图片/封面 referer 防盗链（`Referer: https://www.bilibili.com`）。

**可借鉴开源**：
- [SocialSisterYi/bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)（官方非官方 API 圣经，`player/v2` 字段表、wbi 签名算法都在这）
- [IndieKKY/bilibili-subtitle](https://github.com/IndieKKY/bilibili-subtitle)（浏览器扩展，`view`→`player/v2`→subtitles，`credentials:'include'` 写法直接可抄，issue#33 有完整代码）
- [JimmyLv/BibiGPT-v1 `fetchBilibiliSubtitleUrls.ts`](https://github.com/JimmyLv/BibiGPT-v1/blob/220cf2ab8d71e9115b029a550ae9e27eed372e6e/lib/bilibili/fetchBilibiliSubtitleUrls.ts)（TS 实现，多 P 处理）
- [Kihara-Ri/bili-video-info_TO_Notion](https://github.com/Kihara-Ri/bili-video-info_TO_Notion)（view + pagelist + player/v2 → subtitle_url 流程图）

---

## Caveats / 总结
- **登录态依赖**：B站字幕、小红书正文都强依赖用户在浏览器中已登录；扩展走 content script 复用 cookie 是可行路径，但首启需提示用户登录。
- **小红书签名**：明确**不自建签名调 API**，改读 `__INITIAL_STATE__` 或拦截页面 XHR（MAIN world 注入），否则维护成本高且封号。
- **MV3 注意**：读页面全局变量（XHS `__INITIAL_STATE__`）需 MAIN world 注入脚本 + `window.postMessage` 回传 isolated world；跨域 fetch（B站 API）需 `host_permissions`；图片防盗链转存统一在后台带/去 `Referer`。
- 未验证项：各平台前端类名（知乎/小红书）随版本变动频繁，落地前需对当前线上 DOM 实测一次。
