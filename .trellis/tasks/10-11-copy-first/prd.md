# Page Clipper：以复制为主，Obsidian 导入改为可选

## 背景
插件目前完全围绕 Obsidian：主按钮是"剪藏到 Obsidian"，未配置 REST 密钥时 popup 弹配置报错并禁用主操作。产品定位改为 **copy everything**——把任意网页抽取成干净的 Markdown 并复制；Obsidian 导入只是可选附加功能，由设置页开关控制。

## 已确认的决定
- 复制内容：保持现状，完整 Markdown（含 frontmatter、备注、标签），即 `toMarkdown()` 输出不变。
- 开关：放在设置页，**默认关闭**（配置中缺省该字段即视为关闭；已有的连接配置保留不删）。
- 产品改名为 **Page Clipper**。

## 需求

### 配置（lib/settings.ts）
- `ClipperConfig` 新增 `exportEnabled: boolean`，`migrateConfig` 缺省为 `false`；旧版扁平配置迁移后同样为 `false`，但保留其连接字段。
- storage key（`obsidianWikiClipper.settings.v1`、`obsidianWikiClipper.tags.v1`）**不改名**，避免用户数据丢失。
- 提供读取"导出是否启用"的便捷方法（如 `lib/connectors/index.ts` 的 active state 带上 `enabled`）。

### popup
- 主按钮改为 **"复制 Markdown"**（primary，Copy 图标），复制成功后同样调用 `saveUsedTags` 记录标签历史。
- 开关关闭：不显示保存按钮、不显示配置报错浮层、header 不显示 "→ Obsidian"。
- 开关开启：底部增加次按钮"保存到 {connector.name}"（outline），配置报错浮层与原逻辑一致，只禁用保存按钮，复制始终可用。
- 设置变化（`onSettingsChanged`）实时生效。
- header 标题改为 "Page Clipper"；`popup/index.html` 的 `<title>` 改为 "Page Clipper"。

### background
- `CAPTURE` 消息在导出关闭时返回 `{ ok: false, error: 'Obsidian 导入未开启', needsSettings: true }`（文案用 connector 名称），不写入。

### 设置页
- 第一块改为"导出到应用"：一个 Switch（新增 `components/ui/switch.tsx`，基于 `radix-ui` 的 Switch，shadcn new-york 风格），标签"保存到 Obsidian"，说明"开启后 popup 会多一个保存按钮，把剪藏写入 vault。复制功能始终可用。"
- 开关开启时才显示：目标应用选择、连接、保存路径三块；关闭时隐藏（配置值保留）。
- 保存：开关关闭时跳过 connector 校验，仅保存 `exportEnabled`；开启时按原逻辑校验。
- 页面标题与 header 品牌改为 "Page Clipper"；`options/index.html` title 改为 "Page Clipper 设置"。

### 命名与文案
- `wxt.config.ts`：`name: 'Page Clipper'`，`description: '把任意网页一键复制为干净的 Markdown，可选保存到 Obsidian'`。
- `package.json` name 改为 `page-clipper`。
- README.md、PRODUCT.md、DESIGN.md 中的产品名与定位描述同步更新（复制为主，Obsidian 为可选目标）。

## 非目标
- 不改抽取逻辑、`toMarkdown` 输出格式、connector 接口与 Obsidian 写入实现。
- 不新增复制格式选项。

## 验收
- [ ] 全新安装：popup 只有"复制 Markdown"，无配置报错。
- [ ] 设置页打开开关并配置后：popup 出现"保存到 Obsidian"，可保存。
- [ ] 开关关闭后已有连接配置仍保留，重新开启无需重填。
- [ ] `bunx tsc --noEmit -p .` 与 `bun run build` 通过。
