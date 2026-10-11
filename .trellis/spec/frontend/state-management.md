# State & Cross-Layer Message Contract

> Data flow across popup ↔ background ↔ content script, and the capture shape.

There is no client state library. "State" here is the message protocol between the
three extension contexts and the single capture object that flows through them.

---

## Scenario: Clip the active tab

### 1. Scope / Trigger

Cross-layer request/response contract between popup, background service worker, and
content script. Changing any message type or `RawCapture` field is a contract change —
update this file.

### 2. Signatures (messages)

```typescript
// popup → background
{ type: 'EXTRACT' }                       // returns { ok, data?: RawCapture, error? }
{ type: 'CAPTURE', data: RawCapture, note: string, tags: string[] } // returns { ok, path?, error? }

// background → content (forwarded)
{ type: 'EXTRACT' }                       // content returns { ok, data?: RawCapture, error? }
```

### 3. Contracts

- `RawCapture` (see `lib/normalize.ts`) is the **single capture object**:
  `source_platform, source_id, canonical_url, title, author, captured_at,
  raw_text, outbound_urls[], user_note, tags[]`.
- **EXTRACT** runs adapter routing in the content script and returns a `RawCapture`
  with `user_note: ''`. It does **not** write anything.
- **CAPTURE** receives the *already-extracted* `data` + `note` + selected `tags`
  and writes via the **active connector** (`saveWithActiveConnector` in
  `lib/connectors`). It must **not** re-extract and must **not** call
  Obsidian/`vault.ts` directly — it dispatches through the connector registry so
  future save targets need no background change. The background applies
  `user_note` and normalized `tags` to the final `RawCapture` before saving.
- Tag history lives separately in `chrome.storage.local` under
  `obsidianWikiClipper.tags.v1`; do not mix it into connector settings. The popup
  updates this history only after a successful save, so failed clips do not add
  draft tags to future suggestions.
- Runtime config lives in `chrome.storage.local` under
  `obsidianWikiClipper.settings.v1` as a **connector config object**:
  `{ activeConnector: string, connectors: Record<string, Record<string,string>> }`.
  Each connector owns its own flat string config (the Obsidian connector's config
  is `restUrl`, `restToken`, `saveBaseDir`, `pathTemplate`).
- **Migration / back-compat**: `migrateConfig` (in `lib/settings.ts`) reads the
  same key with fallback. Old builds stored *flat* Obsidian settings
  (`{ restUrl, restToken, saveBaseDir, pathTemplate }`) under this key; they are
  wrapped into `{ activeConnector: 'obsidian', connectors: { obsidian: <flat> } }`
  so previously saved settings are never dropped. The storage key is unchanged.
- Default save config preserves the old write path:
  base `_raw/bookmarks`, template `{platform}/{date}-{slug}.md`.
- Path template MVP variables: `{platform}`, `{date}`, `{slug}`.
- REST URL/token are configured in the options page at runtime; do not depend on
  build-time `import.meta.env` secrets.

### Connector contract

```typescript
// lib/connectors/types.ts
export interface Connector {
  id: string
  name: string
  fields: ConnectorField[]                         // options-page form schema
  defaultConfig: ConnectorConfig                   // Record<string,string>
  normalizeConfig(config: ConnectorConfig | undefined): ConnectorConfig
  validateConfig(config: ConnectorConfig): string | null   // null = valid
  testConnection(config: ConnectorConfig): Promise<void>
  save(capture: RawCapture, config: ConnectorConfig): Promise<{ path: string }>
}
```

- Register connectors in the `REGISTRY` array in `lib/connectors/index.ts`. The
  options page enumerates them via `listConnectors()`; background resolves the
  active one via `resolveConnector` / `saveWithActiveConnector`.
- Export to a connector is **opt-in**: `ClipperConfig.exportEnabled` (default
  `false`; `migrateConfig` defaults missing values and legacy flat configs to
  `false` but keeps their connector fields). `getActiveConnectorState()` returns
  `enabled`. Copying Markdown is the primary action and never depends on it.
- Only when `enabled`, the popup shows the "保存到 {name}" button and validates
  the active connector, blocking save + showing the "去设置" entry on missing
  config (`needsSettings`). Background `CAPTURE` re-checks `enabled` and refuses
  to write when off (`{ ok:false, error:'<name> 导入未开启', needsSettings:true }`).
- Turning export off in options saves `exportEnabled:false` without validating
  or clearing connector config, so re-enabling needs no re-entry.
- Storage keys keep the legacy `obsidianWikiClipper.*` prefix after the Page
  Clipper rename — renaming them would drop users' saved config.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| No active tab | `{ ok:false, error:'No active tab' }` |
| Content script not ready | `{ ok:false, error:'…reload the page and try again' }` (do not throw) |
| Adapter throws | Should not happen — adapters fall back to `generic` (see component-guidelines) |
| Vault PUT non-2xx | `writeRaw` throws `Vault write failed: <status>` → surfaced as `{ ok:false }` |
| Missing REST URL/token or failed connection test (export enabled) | popup blocks saving (copy still works) and links to options page |
| Export disabled | popup hides save; background `CAPTURE` returns `<name> 导入未开启` |

### 5. Good/Base/Bad Cases

- **Good**: configure options → open popup → EXTRACT returns RawCapture → preview
  shows full markdown → edit note (local re-render, no re-extract) → CAPTURE uses
  the stored REST config and path template to write once.
- **Base**: unknown site → `generic` (defuddle) extracts → still previews/saves.
- **Bad**: login-walled page → adapter falls back, preview shows minimal capture
  (title + URL); user still can save.

### 6. Tests Required

No automated tests in repo; `bun x tsc --noEmit` + `bun run build` are the gate.
Manual assertion points: preview bytes == written bytes; note edits don't trigger
re-extract; `captured_at` is fixed once per popup open (preview == file); default
save settings still produce `_raw/bookmarks/{platform}/{date}-{slug}.md`.

### 7. Wrong vs Correct

#### Wrong
```typescript
// CAPTURE re-extracts → preview and saved file can diverge; captured_at shifts
case 'CAPTURE': { const data = await extract(); writeRaw(toMarkdown({...data, note})) }
```

#### Correct
```typescript
// popup extracts once, builds preview locally, sends the SAME data + selected tags to CAPTURE
const data = (await send({ type: 'EXTRACT' })).data
const tags = normalizeTags(selectedTags)
preview.value = toMarkdown({ ...data, user_note: note, tags }) // single source of truth
await send({ type: 'CAPTURE', data, note, tags })
```

**Single source of truth**: both preview and write go through
`normalize.toMarkdown`, so "what you copy" equals "what gets written".
