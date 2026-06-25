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
{ type: 'CAPTURE', data: RawCapture, note: string } // returns { ok, path?, error? }

// background → content (forwarded)
{ type: 'EXTRACT' }                       // content returns { ok, data?: RawCapture, error? }
```

### 3. Contracts

- `RawCapture` (see `lib/normalize.ts`) is the **single capture object**:
  `source_platform, source_id, canonical_url, title, author, captured_at,
  raw_text, outbound_urls[], user_note, tags[]`.
- **EXTRACT** runs adapter routing in the content script and returns a `RawCapture`
  with `user_note: ''`. It does **not** write anything.
- **CAPTURE** receives the *already-extracted* `data` + `note` and writes to the
  vault. It must **not** re-extract.
- Write path (unchanged contract):
  `_raw/bookmarks/{source_platform}/{captured_at date}-{slug(source_id||canonical_url)}.md`
- Env keys (build-time, `import.meta.env`): `VITE_OBSIDIAN_REST_URL`
  (default `http://localhost:27123`), `VITE_OBSIDIAN_REST_KEY` (optional Bearer).

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| No active tab | `{ ok:false, error:'No active tab' }` |
| Content script not ready | `{ ok:false, error:'…reload the page and try again' }` (do not throw) |
| Adapter throws | Should not happen — adapters fall back to `generic` (see component-guidelines) |
| Vault PUT non-2xx | `writeRaw` throws `Vault write failed: <status>` → surfaced as `{ ok:false }` |

### 5. Good/Base/Bad Cases

- **Good**: open popup → EXTRACT returns RawCapture → preview shows full markdown →
  edit note (local re-render, no re-extract) → CAPTURE writes once.
- **Base**: unknown site → `generic` (defuddle) extracts → still previews/saves.
- **Bad**: login-walled page → adapter falls back, preview shows minimal capture
  (title + URL); user still can save.

### 6. Tests Required

No automated tests in repo; `pnpm exec tsc --noEmit` + `pnpm build` are the gate.
Manual assertion points: preview bytes == written bytes; note edits don't trigger
re-extract; `captured_at` is fixed once per popup open (preview == file).

### 7. Wrong vs Correct

#### Wrong
```typescript
// CAPTURE re-extracts → preview and saved file can diverge; captured_at shifts
case 'CAPTURE': { const data = await extract(); writeRaw(toMarkdown({...data, note})) }
```

#### Correct
```typescript
// popup extracts once, builds preview locally, sends the SAME data to CAPTURE
const data = (await send({ type: 'EXTRACT' })).data
preview.value = toMarkdown({ ...data, user_note: note }) // single source of truth
await send({ type: 'CAPTURE', data, note })
```

**Single source of truth**: both preview and write go through
`normalize.toMarkdown`, so "what you copy" equals "what gets written".
