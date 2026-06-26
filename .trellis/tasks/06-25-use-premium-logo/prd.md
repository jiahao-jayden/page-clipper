# Use Premium Logo As Extension Logo

## Goal

Use the selected premium logo image as the browser extension logo so the built extension presents the chosen product identity in browser surfaces.

## What I Already Know

* The user selected `wiki-clipper-logo-premium.png` as the preferred logo direction.
* The project is a WXT browser extension named `Wiki Clipper`.
* WXT auto-discovers PNG extension icons in `public/` using names such as `icon-16.png`, `icon-32.png`, `icon-48.png`, and `icon-128.png`.
* The repository currently has no committed PNG/SVG icon assets.

## Requirements

* Add extension icon assets derived from the selected premium logo.
* Use WXT's default public icon discovery convention instead of adding unnecessary manifest configuration.
* Keep the existing product name, description, permissions, and popup UI unchanged.

## Acceptance Criteria

* [x] `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, and `public/icon-128.png` exist.
* [x] The generated icon assets are based on the selected premium logo.
* [x] `bun run build` succeeds.

## Definition Of Done

* Build passes.
* No unrelated files are changed.
* The implementation follows the existing WXT project conventions.

## Technical Approach

Create a `public/` directory if needed, generate the standard extension icon PNG sizes from the selected logo image, and rely on WXT's automatic manifest icon discovery.

## Out Of Scope

* Redesigning the popup UI.
* Changing the app name, copy, permissions, or manifest behavior beyond icon discovery.
* Creating a hand-authored SVG logo system.

## Technical Notes

* Selected source image: `/Users/jayden/.cursor/projects/Users-jayden-code-obsidian-wiki-clipper/assets/wiki-clipper-logo-premium.png`
* WXT docs confirmed PNG icon discovery from `public/` via `icon-<size>.png` names.
* Verified `.output/chrome-mv3/manifest.json` contains `icons` entries for `16`, `32`, `48`, and `128`.
* Regenerated `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, and `public/icon-128.png` with transparent backgrounds by removing the source image's corner background color.
* Enlarged and centered the alpha-bounded foreground without changing aspect ratio; the 48px icon foreground now occupies about 63% width and 81% height, keeping the long edge in the target range while preserving the tall logo proportions.
* Regenerated toolbar-focused icon assets with more aggressive centering and scaling for Chrome action surfaces; the transparent foreground now reaches about 15/16px, 29/32px, 44/48px, and 114/128px on the long edge, with low-alpha background residue removed for clearer small-size rendering.
