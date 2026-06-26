# Directory Structure

> How this WXT browser-extension codebase is organized.

---

## Overview

This is a **WXT 0.20 + TypeScript + React, Chrome MV3** browser extension that
clips web pages into an Obsidian vault via the Obsidian Local REST API. Code
splits into WXT *entrypoints*, a React popup, reusable UI primitives, and a
plain-TS *lib*.

---

## Directory Layout

```
entrypoints/
├── background.ts          # service worker: message broker + vault write
├── content.ts             # default content script (isolated world): routes to adapters
├── xhs-main.content.ts    # MAIN-world content script (reads page globals, e.g. __INITIAL_STATE__)
├── options/               # React options page: runtime REST + save-path settings
└── popup/
    ├── index.html         # popup HTML shell
    ├── main.tsx           # React mount + global CSS import
    └── App.tsx            # popup logic: auto-extract, live preview, clip, copy

components/
└── ui/                    # shadcn-style React primitives used by popup

assets/
└── tailwind.css           # Tailwind v4 + OKLCH CSS variables

lib/
├── adapters/              # one module per platform + a router
│   ├── index.ts           # registry + extractForUrl(url) router
│   ├── generic.ts         # fallback (defuddle), matches() always true
│   ├── twitter.ts, zhihu.ts, wechat.ts, weibo.ts, xiaohongshu.ts
├── connectors/            # one module per save target + a registry
│   ├── index.ts           # registry + active-connector resolution/save/validate
│   ├── types.ts           # Connector interface + ConnectorConfig/Field shapes
│   └── obsidian.ts        # Obsidian connector (wraps settings.ts + vault.ts)
├── extract/
│   └── pipeline.ts        # htmlToMarkdown(root, baseUrl) + defuddleExtract(url)
├── normalize.ts           # RawCapture type, toMarkdown(), slug()
├── platform.ts            # lightweight host→platform/display/favicon helpers
├── settings.ts            # connector config storage/migration + Obsidian helpers
├── tags.ts                # tag normalization + local tag-history storage
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
- **Lightweight platform identity** belongs in `lib/platform.ts` when both popup UI
  and extraction code need it. Do not import `lib/extract/pipeline.ts` into the
  popup just to reuse host/platform mapping; that would drag extraction
  dependencies into the popup bundle.
- **Config/secrets** live in extension runtime storage via `lib/settings.ts`.
  The options page lets users configure Obsidian REST URL/token plus the save base
  directory and path template. Do not rely on build-time `.env.local` for shipping
  secrets.
- **Clip tag history** lives in extension runtime storage via `lib/tags.ts` under
  a key separate from connector settings. Tag normalization/history rules belong
  there so popup preview, save payloads, and future tag UI reuse the same behavior.
- **A new save target = a new file under `lib/connectors/`** implementing the
  `Connector` contract (`lib/connectors/types.ts`), registered in the `REGISTRY`
  array in `lib/connectors/index.ts`. Connectors must reuse existing shared logic
  (`lib/settings.ts`, `lib/vault.ts`, `lib/normalize.ts`), never duplicate it.
  Background and the options page only talk to connectors through the registry —
  adding a connector (e.g. Notion) must not change the background write flow.

---

## Naming Conventions

- Adapter file = platform slug (`zhihu.ts`, `wechat.ts`); its `source_platform`
  value matches the slug (`'zhihu'`, `'wechat'`, `'weibo'`, `'xiaohongshu'`, `'x'`).
- MAIN-world content scripts use the `*.content.ts` suffix with `world: 'MAIN'`.

## Options page: open in a full tab

The options entrypoint must open as a standalone browser tab, not the embedded
dialog Chrome shows inside `chrome://extensions`. WXT generates `options_ui` from
the `entrypoints/options/` HTML entrypoint and defaults `open_in_tab` to `false`,
overriding any `manifest.options_ui` set in `wxt.config.ts`. Configure it the
WXT-idiomatic way via a meta tag in `entrypoints/options/index.html`:

```html
<meta name="manifest.open_in_tab" content="true" />
```

Verify the built `.output/chrome-mv3/manifest.json` has
`options_ui.open_in_tab: true`. `chrome.runtime.openOptionsPage()` from the popup
settings icon then opens this full tab.
