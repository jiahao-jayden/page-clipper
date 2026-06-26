# brainstorm: 设置页面与密钥配置

## Goal

增加一个运行时设置页面，让用户不必修改 `.env.local` 或重新构建扩展，就能配置 Obsidian REST API 密钥、服务地址，以及剪藏内容要保存到 vault 中的目标位置。

## What I already know

* 用户希望增加“设置页面”。
* 设置页面需要支持配置用户的密钥。
* 设置页面需要支持配置“要保存的地方”等信息。
* 当前 popup 只有 `entrypoints/popup/App.tsx` / `main.tsx` / `index.html`，没有独立 settings/options 入口。
* 当前剪藏由 popup 发送 `CAPTURE` 到 `entrypoints/background.ts`，background 调用 `lib/vault.ts` 写入 Obsidian Local REST API。
* 当前 Obsidian REST 配置来自 build-time env：`VITE_OBSIDIAN_REST_URL` 和 `VITE_OBSIDIAN_REST_KEY`。
* 当前保存路径硬编码为 `_raw/bookmarks/{source_platform}/{date}-{slug}.md`。
* 项目使用 WXT + React，包管理与命令使用 `bun`。
* 用户已确认设置入口采用独立 Options Page；popup 中只增加一个轻量设置图标，用于打开该页面。
* 用户希望当前硬编码保存位置成为默认配置，同时保存位置和路径模板都可以由用户自己配置。
* 用户已确认路径模板 MVP 只支持基础变量：`{platform}`、`{date}`、`{slug}`。
* 用户已确认 MVP 需要设置页“测试连接”按钮，用于验证 REST URL/token 是否可用。
* 用户已确认配置缺失或连接失败时，popup 应阻止剪藏，并显示打开设置页的入口。
* 用户已确认产品方向：保存目标应抽象为可插拔的 connector，Obsidian 只是第一个，未来会有 Notion 等其他 connector。本任务现在就引入 connector 抽象，但只实现 Obsidian，为后续 connector 预留接口。

## Assumptions (temporary)

* 设置应使用扩展的 runtime storage，而不是继续依赖 `.env.local`。
* “密钥”指 Obsidian Local REST API Bearer token。
* “保存的地方”指 vault 内路径配置，不是选择本机文件夹。
* MVP 应覆盖 Obsidian REST URL、token、保存基础目录、路径模板这几个字段。

## Open Questions

* 等待最终需求确认。

## Requirements (evolving)

* 用户可以在 UI 中配置 Obsidian REST API 服务地址。
* 用户可以在 UI 中配置 Obsidian REST API 密钥。
* 用户可以配置剪藏文件在 vault 内的保存基础目录。
* 用户可以配置剪藏文件的路径模板。
* 系统提供与当前行为一致的默认保存配置：基础目录 `_raw/bookmarks`，模板 `{platform}/{date}-{slug}.md`。
* 路径模板 MVP 支持变量：`{platform}`、`{date}`、`{slug}`。
* 设置页提供“测试连接”按钮，验证 Obsidian REST URL/token 是否可用，并显示成功/失败状态。
* 设置 UI 以独立 Options Page 为主。
* popup header 增加一个轻量设置图标，点击后打开 Options Page。
* 剪藏时 background 使用运行时配置写入 Obsidian，而不是只读取 build-time env。
* 配置缺失或连接失败时，popup 阻止剪藏，并引导用户打开设置页。
* 保存目标抽象为 connector：定义统一的 connector 接口（保存、测试连接、配置 schema），background 按所选 connector 分发写入。
* 设置页提供「保存目标 / connector」选择；本次只有 Obsidian 一个选项，其配置项（REST URL/token、基础目录、路径模板）归属于 Obsidian connector。
* connector 注册表为未来 connector（如 Notion）预留接口，但本任务不实现 Notion。

## Acceptance Criteria (evolving)

* [ ] 用户能从扩展 options 入口打开设置页面。
* [ ] 用户能从 popup 的设置图标打开设置页面。
* [ ] 用户能保存 REST URL、token、保存基础目录、路径模板配置。
* [ ] 用户能在设置页点击“测试连接”并看到成功或失败反馈。
* [ ] 重新打开扩展后，配置仍然存在。
* [ ] 点击剪藏时使用已保存配置写入 vault。
* [ ] 未修改保存配置时，剪藏路径保持当前默认行为。
* [ ] 未配置时给出清晰错误或合理默认值。
* [ ] 配置缺失或连接失败时，popup 显示“去设置”入口且不会写入 vault。
* [ ] 设置页存在「保存目标 / connector」选择，当前包含 Obsidian。
* [ ] connector 抽象存在统一接口与注册表，Obsidian 通过该接口实现，新增 connector 无需改动 background 写入主流程。
* [ ] `bun x tsc --noEmit` 与 `bun run build` 通过。

## Decision (ADR-lite)

**Context**: 保存目标当前写死为 Obsidian Local REST API；产品方向是支持多个保存目标（Notion 等）。

**Decision**: 现在就把保存目标抽象为可插拔 connector（统一接口 + 注册表 + 设置页选择），但本任务只实现 Obsidian connector，为后续 connector 预留接口。

**Consequences**: settings 数据结构从扁平的 `restUrl/token/...` 演进为「当前 connector + 各 connector 配置」；短期增加一层抽象成本，换取后续新增 connector 的低改动成本。需保证默认行为与现有 Obsidian 写入路径完全一致。

## Definition of Done (team quality bar)

* Tests added/updated if appropriate for touched logic.
* Lint / typecheck / build green.
* Docs/spec notes updated if the runtime config contract changes.
* Rollback considered if storage schema or message contract changes.

## Out of Scope (explicit)

* 不在本任务中实现多 vault 管理，除非后续确认需要。
* 不在本任务中实现云端同步账户体系。
* 不在本任务中改变内容抽取 adapter 行为。
* 不在 MVP 中支持 `{title}`、`{author}`、`{source_id}` 等扩展路径模板变量。

## Technical Notes

* Likely touched files: `entrypoints/popup/App.tsx`, `entrypoints/background.ts`, `lib/vault.ts`, `wxt.config.ts`, possibly a new settings/options entrypoint.
* Current message contract is documented in `.trellis/spec/frontend/state-management.md`; adding settings/config messages or storage changes likely needs spec update.
* Current manifest permissions are `activeTab` and `tabs`; runtime persistence will likely need `storage`.
