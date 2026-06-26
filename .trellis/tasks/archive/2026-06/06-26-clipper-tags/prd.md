# 剪藏时支持标签

## Goal

在剪藏网页到 Obsidian 的同时，允许用户为本次剪藏增加标签。用户可以复用之前创建过的标签，也可以在剪藏时创建新的标签；最终标签应写入保存的 Markdown frontmatter，便于 Obsidian 后续检索和组织。

## What I already know

* 用户希望在剪藏时增加标签。
* 用户希望可以选择之前创建过的标签。
* 用户希望可以设置新的标签。
* 项目是 WXT + React + TypeScript 的 Chrome MV3 扩展，使用 Bun。
* 当前剪藏数据结构 `RawCapture` 已包含 `tags: string[]` 字段。
* 当前各 adapter / extract pipeline 初始化 `tags: []`。
* 当前 `toMarkdown()` 没有使用 `RawCapture.tags`，而是固定写入 `tags: [status/captured, source/<platform>]`。
* 当前 popup 已有备注输入、Markdown 预览、剪藏按钮和复制 Markdown 按钮。
* 当前剪藏消息链路是 popup 发送 `CAPTURE`，background 只覆盖 `user_note` 后通过 active connector 保存。
* 当前运行时设置保存在 `chrome.storage.local` 的 `obsidianWikiClipper.settings.v1`，主要用于 connector 配置。

## Requirements

* 用户可以在 popup 中为当前剪藏添加标签。
* 用户可以从历史标签中选择。
* 用户可以输入新的标签。
* popup 使用轻量 chips 交互：输入框用于新建标签，回车添加到本次剪藏；历史标签以可点击 chips 展示；已选标签以 chips 展示并可移除。
* 新建标签只有在剪藏保存成功后才进入历史标签，避免未使用标签污染历史。
* 历史标签按最近成功使用排序。
* 标签以 Obsidian/YAML frontmatter 友好的形式保存，不带 `#`；用户输入 `#tag` 时保存前规范化为 `tag`。
* 系统标签 `status/captured` 和 `source/<platform>` 应继续保留，用户标签作为附加项写入 frontmatter。
* 保存到 Obsidian 的 Markdown frontmatter 中包含用户选择/新增的标签。
* Markdown 预览和实际保存内容保持一致。

## Acceptance Criteria

* [ ] 用户在 popup 添加标签后，预览中的 `tags` 立即反映变化。
* [ ] 用户可以点击历史标签 chip 添加到本次剪藏。
* [ ] 用户可以移除已选标签。
* [ ] 点击剪藏后，保存到 Obsidian 的 Markdown frontmatter 包含用户标签。
* [ ] 用户创建过的标签在下次打开 popup 时可再次选择。
* [ ] 历史标签按最近成功使用排序。
* [ ] 保存失败时，新输入标签不会写入历史标签。
* [ ] 重复标签不会在 frontmatter 中重复出现。
* [ ] 空标签不会被保存。
* [ ] 输入 `#ai` 保存为 `ai`，输入 `project/wiki` 保持为 `project/wiki`。
* [ ] 现有系统标签 `status/captured`、`source/<platform>` 继续存在。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不做完整标签管理页面，除非后续确认需要。
* 不做标签重命名、删除、合并等管理功能，除非后续确认需要。
* 不从 Obsidian vault 反向读取已有标签，除非后续确认需要。
* 不做复杂搜索/过滤，除非后续确认需要。
* 不改变内容抽取 adapter 行为。

## Technical Notes

* Relevant files inspected:
  * `lib/normalize.ts`
  * `entrypoints/popup/App.tsx`
  * `entrypoints/background.ts`
  * `entrypoints/options/App.tsx`
  * `lib/connectors/obsidian.ts`
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/directory-structure.md`
* Existing frontmatter currently serializes fixed tags only:
  `tags: [status/captured, source/${c.source_platform}]`.
* Implementation should add `lib/tags.ts` for tag normalization/history storage and popup UI state that passes selected tags through `RawCapture.tags`.
* Confirmed design doc: `docs/superpowers/specs/2026-06-26-clipper-tags-design.md`.

## Decisions (ADR-lite, evolving)

### Tag History Persistence

**Context**: The user can create tags while clipping, but drafts or accidental inputs should not pollute future suggestions.

**Decision**: Persist newly created tags into history only after the clip save succeeds.

**Consequences**: Popup state can show draft tags immediately for the current clip, while the persistent history only records tags that were actually used. Save failure must not update tag history.

### Tag Normalization

**Context**: Users may naturally type `#tag`, while Obsidian frontmatter tags are cleaner and more consistent without the leading hash.

**Decision**: Store user tags without `#`. Normalize user input by trimming whitespace, removing a leading `#`, dropping empty tags, and de-duplicating.

**Consequences**: The UI can accept familiar hashtag-style input while saved Markdown remains consistent. Existing path-like tags such as `project/wiki` remain supported.

### Popup Interaction

**Context**: The popup already has a compact flow with preview, note, clip, and copy actions. Tags should not turn clipping into a heavy management UI.

**Decision**: Use a lightweight chips interaction: an input adds new tags with Enter, selected tags render as removable chips, and historical tags render as clickable chips.

**Consequences**: This keeps the MVP easy to use and implement in the existing popup. If tag history grows large later, the chips area can evolve into a searchable combobox without changing the underlying tag model.

### MVP Scope

**Context**: Tags touch popup UI, persistent history, message payloads, Markdown serialization, and connector save behavior. The first version should avoid expanding into full tag management.

**Decision**: Build only lightweight popup tagging, local tag history, save-success persistence, and recent-use sorting.

**Consequences**: The feature stays focused on the clipping moment. Tag management, search/filtering, and reading tags from Obsidian vault remain future work.

### Technical Approach

**Context**: Tag behavior needs consistent normalization across preview, save, and history persistence. Keeping all logic inside `App.tsx` would make the popup harder to maintain.

**Decision**: Add `lib/tags.ts` as a small reusable tag helper/store module for normalization, de-duplication, storage reads/writes, and recent-use ordering. Keep popup UI state local, and pass selected tags through `RawCapture.tags` for preview and save.

**Consequences**: The popup remains focused on interaction, while tag rules are centralized and testable. Future options-page tag management or searchable selection can reuse the same helper.
