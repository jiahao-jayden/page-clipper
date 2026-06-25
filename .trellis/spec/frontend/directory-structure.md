# Directory Structure

> How this WXT browser-extension codebase is organized.

---

## Overview

This is a **WXT 0.20 + TypeScript, Chrome MV3** browser extension that clips web
pages into an Obsidian vault via the Obsidian Local REST API. No React/framework —
the popup is plain HTML + a TS module. Code splits into WXT *entrypoints* and a
plain-TS *lib*.

---

## Directory Layout

```
entrypoints/
├── background.ts          # service worker: message broker + vault write
├── content.ts             # default content script (isolated world): routes to adapters
├── xhs-main.content.ts    # MAIN-world content script (reads page globals, e.g. __INITIAL_STATE__)
└── popup/
    ├── index.html         # popup markup + inline <style> (clean light UI)
    └── main.ts            # popup logic: auto-extract, live preview, clip, copy

lib/
├── adapters/              # one module per platform + a router
│   ├── index.ts           # registry + extractForUrl(url) router
│   ├── generic.ts         # fallback (defuddle), matches() always true
│   ├── twitter.ts, zhihu.ts, wechat.ts, weibo.ts, xiaohongshu.ts
├── extract/
│   └── pipeline.ts        # htmlToMarkdown(root, baseUrl) + defuddleExtract(url)
├── normalize.ts           # RawCapture type, toMarkdown(), slug()
├── vault.ts               # writeRaw(path, content) → Obsidian REST PUT
└── xhs-bridge.ts          # shared postMessage protocol for MAIN↔isolated bridge

wxt.config.ts              # manifest (permissions, host_permissions)
```

---

## Module Organization

- **A new platform = a new file under `lib/adapters/`** implementing the `Adapter`
  contract (see component-guidelines.md), registered in `lib/adapters/index.ts`
  before `generic`.
- **Extraction/markdown logic is shared** in `lib/extract/pipeline.ts` — adapters
  must reuse it, never re-implement HTML→Markdown.
- **Config/secrets** come from `.env.local` (`VITE_OBSIDIAN_REST_*`), injected at
  build time via `import.meta.env`. There is no runtime settings page.

---

## Naming Conventions

- Adapter file = platform slug (`zhihu.ts`, `wechat.ts`); its `source_platform`
  value matches the slug (`'zhihu'`, `'wechat'`, `'weibo'`, `'xiaohongshu'`, `'x'`).
- MAIN-world content scripts use the `*.content.ts` suffix with `world: 'MAIN'`.
