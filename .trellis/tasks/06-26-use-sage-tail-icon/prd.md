# Use Sage Tail icon

## Goal

将用户确认喜欢的“鼠尾巴 / Sage Tail”形象落地为 Wiki Clipper 的正式扩展图标资产，并在项目设计语境中记录该品牌方向。

## Requirements

* 使用已生成并被用户确认的图片作为源图：`/Users/jayden/.cursor/projects/Users-jayden-code-obsidian-wiki-clipper/assets/sage-tail-icon.png`。
* 将源图复制进 repo，保留为可追踪品牌源资产。
* 生成 WXT 可自动发现的扩展图标：`public/icon-16.png`、`public/icon-32.png`、`public/icon-48.png`、`public/icon-128.png`。
* 保持当前产品的 “Quiet Workbench / Functional Sage” 视觉方向，不额外引入卡通化 UI 或新交互。
* 如更新文档，应把形象描述为“鼠尾巴 / Sage Tail”：安静、精确、轻轻卷走知识的 clipping 符号。

## Acceptance Criteria

* [ ] repo 内存在源图资产。
* [ ] `public/icon-16.png`、`public/icon-32.png`、`public/icon-48.png`、`public/icon-128.png` 存在。
* [ ] 图标主体在浏览器扩展栏小尺寸下足够大，不因白边过多而看不清。
* [ ] 生成后的 Chrome MV3 manifest 包含 16/32/48/128 图标条目。
* [ ] `bun run build` 通过。
* [ ] 不改动 popup 交互逻辑。

## Out of Scope

* 不重新生成新的形象方向。
* 不改 popup 布局或增加吉祥物插画。
* 不调整现有配色 token。

## Technical Notes

* WXT 会从 `public/icon-<size>.png` 自动发现 extension icons。
* 设计上下文：`DESIGN.md` 的 north star 是 `Quiet Workbench`，主色是 restrained sage green。
* 产品上下文：`PRODUCT.md` 定义为 calm, precise, restrained 的知识剪藏工具。
