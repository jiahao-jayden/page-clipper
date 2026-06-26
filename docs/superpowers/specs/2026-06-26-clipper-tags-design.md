# Clipper Tags Design

## Goal

Support user-defined tags while clipping a page into Obsidian. Users can choose tags they have used before or create new tags in the popup. The saved Markdown frontmatter should include both the existing system tags and the user's selected tags.

## Scope

This is an MVP focused on the clipping moment:

* Add tags in the popup for the current clip.
* Reuse local tag history across popup sessions.
* Persist newly created tags only after a clip saves successfully.
* Sort history by most recent successful use.
* Keep Markdown preview and saved Markdown consistent.

Out of scope:

* Full tag management in the options page.
* Tag rename, delete, merge, or cleanup flows.
* Reading existing tags from the Obsidian vault.
* Complex tag search/filtering.
* Any change to content extraction adapters.

## Architecture

Add a small reusable tag helper module at `lib/tags.ts` instead of embedding tag rules directly in the popup.

Responsibilities:

* `normalizeTag(input)` trims whitespace, removes a leading `#`, and returns an empty value for invalid/empty tags.
* `normalizeTags(inputs)` normalizes a list, drops empty tags, and de-duplicates.
* `getTagHistory()` reads local tag history from `chrome.storage.local`.
* `saveUsedTags(tags)` updates history only after successful clipping, moving used tags to the front.

Use an independent storage key such as `obsidianWikiClipper.tags.v1`. Do not mix tag history into `obsidianWikiClipper.settings.v1`, because settings are connector configuration and tag history is user clipping metadata.

## Popup UI

Add a compact "标签" section near the note input:

* A short input with placeholder text "输入标签后回车".
* Selected tags shown as removable chips.
* Recent history tags shown as clickable chips.
* History chips that are already selected are hidden from the history row.

The popup keeps local state for:

* `selectedTags`
* current tag input text
* `tagHistory`

Adding a tag updates local state immediately and refreshes the Markdown preview. It does not update persistent history until the clip saves successfully.

## Data Flow

On popup open:

1. Extract page content as today.
2. Read tag history from local storage.
3. Render the preview with selected user tags, initially empty.

On tag edit:

1. User types a tag and presses Enter, or clicks a history chip.
2. Popup normalizes and de-duplicates the tag.
3. Popup updates `selectedTags`.
4. Markdown preview calls `toMarkdown({ ...capture, user_note: note, tags: selectedTags })`.

On clip:

1. Popup sends `CAPTURE` with the extracted data, note, and selected tags.
2. Background builds the final `RawCapture` by applying both `user_note` and `tags`.
3. Active connector saves the capture.
4. If save succeeds, popup calls `saveUsedTags(selectedTags)`.
5. If save fails, tag history is not updated.

## Markdown Serialization

Update `toMarkdown()` in `lib/normalize.ts` so it combines:

* `status/captured`
* `source/<platform>`
* normalized user tags from `RawCapture.tags`

The final tag list should be de-duplicated and serialized consistently in frontmatter. Input `#ai` should save as `ai`; input `project/wiki` should remain `project/wiki`.

## Error Handling

Empty tags and duplicate tags should be ignored without blocking the user.

If tag history cannot be read, clipping should still work with an empty history. The popup should silently degrade because tag history is helpful but not required for clipping.

If clipping fails, keep the current selected tags in the popup so the user can retry after fixing settings or connection issues. Do not save new tags to history on failure.

## Testing And Verification

Key checks:

* `normalizeTag("#ai")` returns `ai`.
* `normalizeTags()` drops empty values and de-duplicates.
* `toMarkdown()` includes system tags and user tags.
* `toMarkdown()` does not duplicate tags.
* Popup preview updates when `selectedTags` changes.
* Background save receives and persists selected tags.
* Successful clipping updates history in recent-use order.
* Failed clipping does not update history.

Run the project build command with Bun after implementation.

## Implementation Notes

Likely touched files:

* `lib/tags.ts` for tag normalization and history persistence.
* `lib/normalize.ts` for frontmatter tag serialization.
* `entrypoints/popup/App.tsx` for chips UI, preview state, and save-success history update.
* `entrypoints/background.ts` for passing tags into the final `RawCapture`.

The existing adapter outputs can continue initializing `tags: []`.
