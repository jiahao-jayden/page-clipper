# Clipper Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add, reuse, preview, and save Obsidian frontmatter tags while clipping from the popup.

**Architecture:** Centralize tag normalization/history in `lib/tags.ts`, pass selected popup tags through `RawCapture.tags`, and make `toMarkdown()` merge system tags with user tags. Keep tag history in a separate `chrome.storage.local` key and update it only after successful clipping.

**Tech Stack:** WXT 0.20, React 19, TypeScript 5, Chrome MV3 extension APIs, Bun.

## Global Constraints

* Use Bun for project commands.
* Do not change content extraction adapter behavior.
* Do not mix tag history into connector settings storage.
* Preserve system tags `status/captured` and `source/<platform>`.
* Markdown preview and saved Markdown must use the same tag data.
* New tags enter history only after clipping saves successfully.

---

## File Structure

* Create `lib/tags.ts`: tag normalization, de-duplication, storage key, history read/write.
* Modify `lib/normalize.ts`: import tag normalization and serialize system + user tags.
* Modify `entrypoints/background.ts`: accept `tags` in `CAPTURE` and apply them to final `RawCapture`.
* Modify `entrypoints/popup/App.tsx`: selected-tag state, tag input, chips UI, history read, save-success history update.

## Task 1: Tag Helper

**Files:**
* Create: `lib/tags.ts`

**Interfaces:**
* Produces: `TAGS_KEY`, `normalizeTag(input: string): string`, `normalizeTags(inputs: string[]): string[]`, `getTagHistory(): Promise<string[]>`, `saveUsedTags(tags: string[]): Promise<string[]>`.
* Consumes: Chrome extension storage via `chrome.storage.local`.

- [ ] **Step 1: Create `lib/tags.ts` with pure normalization helpers**

```ts
export const TAGS_KEY = 'obsidianWikiClipper.tags.v1'

export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').trim()
}

export function normalizeTags(inputs: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const input of inputs) {
    const tag = normalizeTag(input)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}
```

- [ ] **Step 2: Add storage helpers**

```ts
interface TagStorageShape {
  history?: unknown
}

export async function getTagHistory(): Promise<string[]> {
  const result = (await chrome.storage.local.get(TAGS_KEY)) as Record<string, TagStorageShape | undefined>
  const value = result[TAGS_KEY]?.history
  return Array.isArray(value) ? normalizeTags(value.filter((item): item is string => typeof item === 'string')) : []
}

export async function saveUsedTags(tags: string[]): Promise<string[]> {
  const used = normalizeTags(tags)
  if (used.length === 0) return getTagHistory()

  const existing = await getTagHistory()
  const next = normalizeTags([...used, ...existing])
  await chrome.storage.local.set({ [TAGS_KEY]: { history: next } })
  return next
}
```

- [ ] **Step 3: Run build**

Run: `bun run build`

Expected: TypeScript/WXT build completes without errors.

## Task 2: Markdown Tag Serialization

**Files:**
* Modify: `lib/normalize.ts`

**Interfaces:**
* Consumes: `normalizeTags()` from `lib/tags.ts`.
* Produces: `toMarkdown(c: RawCapture): string` that includes system tags and normalized user tags.

- [ ] **Step 1: Import normalization helper**

```ts
import { normalizeTags } from './tags'
```

- [ ] **Step 2: Update `toMarkdown()` to merge tags**

```ts
export function toMarkdown(c: RawCapture): string {
  const tags = normalizeTags([
    'status/captured',
    `source/${c.source_platform}`,
    ...c.tags,
  ])

  return `---
source_platform: ${c.source_platform}
source_id: "${c.source_id}"
canonical_url: ${c.canonical_url}
title: "${c.title.replace(/"/g, '\\"')}"
author: ${c.author}
captured_at: ${c.captured_at}
outbound_urls: ${JSON.stringify(c.outbound_urls)}
user_note: "${c.user_note}"
tags: ${JSON.stringify(tags)}
---

${c.raw_text}
`
}
```

- [ ] **Step 3: Verify preview serialization manually**

Temporarily reason through `toMarkdown({ ..., source_platform: 'x', tags: ['#ai', 'project/wiki', 'ai'] })`.

Expected frontmatter tag line: `tags: ["status/captured","source/x","ai","project/wiki"]`.

- [ ] **Step 4: Run build**

Run: `bun run build`

Expected: Build completes without errors.

## Task 3: Background Payload

**Files:**
* Modify: `entrypoints/background.ts`

**Interfaces:**
* Consumes: `msg.tags` from popup `CAPTURE`.
* Produces: final `RawCapture` with `user_note` and `tags` applied before connector save.

- [ ] **Step 1: Update message handler to pass tags**

```ts
if (msg.type === 'CAPTURE') {
  capture(msg.data as RawCapture | undefined, msg.note ?? '', msg.tags ?? [], sendResponse)
  return true
}
```

- [ ] **Step 2: Update `capture()` signature and final object**

```ts
async function capture(
  data: RawCapture | undefined,
  note: string,
  tags: string[],
  sendResponse: (r: unknown) => void,
) {
  if (!data) {
    sendResponse({ ok: false, error: 'No extracted data to capture' })
    return
  }
  const capture: RawCapture = { ...data, user_note: note, tags }

  try {
    const { path } = await saveWithActiveConnector(capture)
    sendResponse({ ok: true, path })
  } catch (e) {
    sendResponse({ ok: false, error: String(e), needsSettings: true })
  }
}
```

- [ ] **Step 3: Run build**

Run: `bun run build`

Expected: Build completes without errors.

## Task 4: Popup Tag UI And State

**Files:**
* Modify: `entrypoints/popup/App.tsx`

**Interfaces:**
* Consumes: `getTagHistory`, `normalizeTag`, `normalizeTags`, `saveUsedTags` from `lib/tags.ts`.
* Produces: UI state `selectedTags`, input text, clickable/removable chips, `CAPTURE` payload with `tags`.

- [ ] **Step 1: Import tag helpers**

```ts
import {
  getTagHistory,
  normalizeTag,
  normalizeTags,
  saveUsedTags,
} from "@/lib/tags";
```

- [ ] **Step 2: Add popup state**

```ts
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [tagInput, setTagInput] = useState("");
const [tagHistory, setTagHistory] = useState<string[]>([]);
```

- [ ] **Step 3: Include selected tags in preview**

```ts
const markdown = useMemo(() => {
  if (!capture) return "";
  return toMarkdown({ ...capture, user_note: note, tags: selectedTags });
}, [capture, note, selectedTags]);
```

- [ ] **Step 4: Load history on popup open**

```ts
useEffect(() => {
  let alive = true;
  void (async () => {
    try {
      const history = await getTagHistory();
      if (alive) setTagHistory(history);
    } catch {
      if (alive) setTagHistory([]);
    }
  })();
  return () => {
    alive = false;
  };
}, []);
```

- [ ] **Step 5: Add tag mutation handlers**

```ts
function addTag(input: string) {
  const tag = normalizeTag(input);
  if (!tag) return;
  setSelectedTags((current) => normalizeTags([...current, tag]));
  setTagInput("");
}

function removeTag(tag: string) {
  setSelectedTags((current) => current.filter((item) => item !== tag));
}

function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  addTag(tagInput);
}
```

- [ ] **Step 6: Send tags on clip and update history only on success**

```ts
const tags = normalizeTags(selectedTags);
const res = await chrome.runtime.sendMessage({
  type: "CAPTURE",
  data: capture,
  note,
  tags,
});
if (res?.ok) {
  setStatus({ text: `✓ 已保存到\n${res.path}`, kind: "ok" });
  const history = await saveUsedTags(tags);
  setTagHistory(history);
}
```

- [ ] **Step 7: Add the tags section near the note section**

```tsx
<section className="mt-4 flex flex-col gap-2">
  <p className="text-[11px] font-medium text-muted-foreground/70">标签</p>
  <input
    value={tagInput}
    onChange={(e) => setTagInput(e.target.value)}
    onKeyDown={handleTagInputKeyDown}
    placeholder="输入标签后回车"
    className="h-9 rounded-md border border-input bg-muted/50 px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
  />
  {selectedTags.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {selectedTags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => removeTag(tag)}
          className="rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
          title="移除标签"
        >
          #{tag} ×
        </button>
      ))}
    </div>
  )}
  {tagHistory.some((tag) => !selectedTags.includes(tag)) && (
    <div className="flex flex-wrap gap-1.5">
      {tagHistory
        .filter((tag) => !selectedTags.includes(tag))
        .map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => addTag(tag)}
            className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            #{tag}
          </button>
        ))}
    </div>
  )}
</section>
```

- [ ] **Step 8: Run build**

Run: `bun run build`

Expected: Build completes without errors.

## Task 5: Final Verification

**Files:**
* Verify: `lib/tags.ts`
* Verify: `lib/normalize.ts`
* Verify: `entrypoints/background.ts`
* Verify: `entrypoints/popup/App.tsx`

**Interfaces:**
* Verifies all previous task interfaces work together.

- [ ] **Step 1: Run project build**

Run: `bun run build`

Expected: Build completes without errors.

- [ ] **Step 2: Manual popup verification**

Run: `bun run dev`

Expected:

* Popup opens and extracts content as before.
* Entering `#ai` adds a selected `#ai` chip but preview stores `ai`.
* Clicking a history chip adds it to the current clip.
* Clicking a selected chip removes it.
* Preview contains `status/captured`, `source/<platform>`, and selected user tags.
* Save success updates history by moving used tags to the front.
* Save failure does not update history.

- [ ] **Step 3: Review docs/spec impact**

If implementation introduces a new convention beyond this plan, update `.trellis/spec/frontend/state-management.md` or related frontend specs. If no new convention is introduced, leave specs unchanged and mention that in the completion notes.
