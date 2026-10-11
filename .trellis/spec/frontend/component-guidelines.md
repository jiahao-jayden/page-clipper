# Component / Adapter Guidelines

> How extraction adapters and the popup are built in this project.

The popup uses React + shadcn-style UI primitives, but the most important reusable
"component" in extraction code is still the **platform adapter**. This file is the
contract for adding/maintaining adapter behavior and popup-facing platform identity.

---

## Pattern: Platform Adapter

**Problem**: Each site needs platform-specific extraction, but markdown conversion,
the capture shape, and the write path must stay uniform.

**Solution**: Each adapter only decides *which DOM is the content* (and fixes
lazy-loaded media); shared code does the rest.

### Contract

```typescript
// lib/adapters/index.ts
export interface Adapter {
  matches(url: string): boolean
  extract(url: string): RawCapture | Promise<RawCapture> // async allowed (subtitles, MAIN-world bridge)
}
```

- Register new adapters in the `adapters` array in `lib/adapters/index.ts`,
  **before `generic`** (whose `matches` is always `true` and is the final fallback).
  Order = priority; first `matches` wins. Current order:
  `twitter → zhihu → wechat → weibo → xiaohongshu → generic`.
- `extractForUrl(url)` awaits the first matching adapter.

### Convention: reuse the shared pipeline

**What**: Adapters select a content root node, then hand it to
`htmlToMarkdown(root, baseUrl)` from `lib/extract/pipeline.ts`. The `generic`
adapter wraps `defuddle`. Never re-implement Turndown/Readability.

```typescript
const root = document.querySelector('.Post-RichTextContainer .RichText')
if (!root || !root.textContent?.trim()) return generic.extract(url) // graceful fallback
const clone = root.cloneNode(true) as HTMLElement
fixImages(clone); fixFormulas(clone)
const markdown = htmlToMarkdown(clone, url)
```

---

## Convention: Clone, don't mutate the live page

**What**: Do image/formula rewrites on `root.cloneNode(true)`, not the real DOM.

**Why**: Adapters run in the user's open tab; mutating the live page is a visible
side effect. (Exception: a *read-only-ish* `click()` to expand collapsed content —
e.g. Zhihu `.ContentItem-more` — is acceptable because content is already in the DOM.)

---

## Convention: Lazy-loaded images

Real image URLs live in data attributes, not `src` (which is often an SVG
placeholder). Write the real URL back onto `src` on the clone before conversion:

- Zhihu: `data-actualsrc` → `data-original` → `src` (and `figure > noscript` fallback)
- WeChat: `data-src`
- B站 read/cv: `data-src`

`htmlToMarkdown` also has a defensive fallback for these attributes, but adapters
should still fix them explicitly.

---

## Convention: site extractors that include replies/comments by default

**What**: Some defuddle site extractors mix other users' replies/comments into the
extracted content unless told not to (option default is `'extractors'`, i.e. "let
the site extractor decide" — the twitter extractor's own default is "include").
When an adapter only wants the author's own post (thread included, replies
excluded), pass `includeReplies: false` through `defuddleExtract(url, options)`:

```typescript
// lib/adapters/twitter.ts
const result = await defuddleExtract(url, { includeReplies: false })
```

- This only drops *other people's* replies; defuddle's X extractor still keeps
  the author's own consecutive thread tweets as part of the post content.
- DOM fallback paths (when defuddle returns no markdown) must mirror the same
  rule by hand — e.g. the twitter fallback only keeps consecutive
  `article[data-testid="tweet"]` nodes whose handle matches the page author,
  stopping at the first tweet by someone else.
- Other platforms default to no special handling; only add `includeReplies`
  (or equivalent) when a site extractor is confirmed to pull in comments.

---

## Convention: Graceful fallback, never throw

Every adapter degrades instead of throwing: missing root / empty text / empty
markdown / login-wall / anti-bot / timeout → return `generic.extract(url)`, and if
even that can throw, wrap it and emit a minimal capture (title + URL). A thrown
adapter breaks the popup's auto-extract.

---

## Pattern: MAIN-world bridge (reading page globals)

**Problem**: Some sites (小红书) keep content in `window.__INITIAL_STATE__`, which the
isolated-world content script cannot read.

**Solution**: a `world: 'MAIN'` content script (`entrypoints/xhs-main.content.ts`)
reads the global and posts a **plain, minimal object** back via `window.postMessage`.
Protocol constants/types live in `lib/xhs-bridge.ts` (shared, no duplication).

Required safety (see `xhs-bridge.ts`):
- one-time unique `token` per request; verify it on the response
- verify `event.source === window` and a fixed `marker` + direction field
- post with `location.origin` (never `'*'`); set a timeout that falls back
- `removeEventListener` + `clearTimeout` when done (no listener leaks)
- MAIN side returns only `{title, desc, images}` — never the whole `__INITIAL_STATE__`

> **Warning**: MAIN-world peers (the page's own JS) can observe the bridge. This is
> acceptable here because the page already owns that data and the response is plain
> text rendered to markdown (no `eval`/`innerHTML`). Do not put privileged data on the bridge.

---

## Forbidden

### Don't: build platform API signatures in the extension

**Why it's bad**: e.g. 小红书 `X-s/X-t` signing (`_webmsxyw`) rots monthly and gets
accounts banned.

**Instead**: read page globals (`__INITIAL_STATE__`) or let the page issue its own
requests; for 站点 with open endpoints used by `defuddle` (B站 `player/v2`), just grant
`host_permissions` and reuse defuddle.

---

## Popup styling

Clean light UI: white background, neutral greys, thin rounded borders, system font.
Popup auto-extracts on open, renders a scrollable markdown preview, and a copy
button — keep it minimal, no flashy styling.

Layout (popup, fixed 420×600): brand header → source card (cover/favicon, title,
platform · author · host) → body preview (only scrolling region; frontmatter
collapsed behind a toggle) → note → tags → footer actions. Toasts float above
the footer and never change layout height.

Note and tags only render when export (`exportEnabled`) is on — they exist to
feed the Obsidian save path (`user_note`/`tags` in `RawCapture`), which is a
no-op while export is off. When off, the body preview simply gets the extra
height (no placeholder/gap left behind), and copy/preview markdown is built
with `user_note: ''`, `tags: []` so copied output never carries stale note/tag
state from a previous export-enabled session.

### Convention: shared form & status primitives

- Text fields use `components/ui/input.tsx` (`Input`) on both popup and options
  page; don't hand-roll input class strings.
- Status/error feedback uses `components/status-notice.tsx` (`StatusNotice`),
  which pairs an icon with the text. Don't prefix messages with `✓` / `✗`.

### Convention: popup platform identity stays lightweight

**What**: Popup UI may need fast platform identity before extraction completes
(logo, display label, fallback hostname). Put shared host/platform helpers in a
lightweight module such as `lib/platform.ts`.

**Why**: The popup should not import `lib/extract/pipeline.ts` or adapters just to
reuse host detection. Pipeline/adapters bring extraction dependencies and page-DOM
concerns into the popup bundle.

```typescript
// Good: shared, dependency-light helper
import { faviconUrlForHost, hostToPlatform, platformDisplayName } from '@/lib/platform'

// Bad: pulls extraction pipeline into popup UI
import { hostToPlatform } from '@/lib/extract/pipeline'
```

**Host matching rule**: match exact hostnames or subdomains only. Avoid broad
`includes()` checks because domains like `notgithub.com` must not resolve as
GitHub.
