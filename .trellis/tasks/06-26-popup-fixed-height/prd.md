# popup 固定高度与浮层提示

## 背景 / 问题

浏览器扩展 popup 宽度已固定（`index.html` 的 `<body class="w-[420px]">`），但**高度从未固定**——高度由内容撑开，浏览器仅给约 600px 上限。`App.tsx` 是普通纵向文档流（`flex flex-col`，无高度约束），底部的状态提示（`status.text`）和配置报错（`configIssue`）按 `&&` 追加在文档流末尾，导致：

1. 提示出现时整体高度被撑高，影响窗口高度。
2. 内容超过 600px 上限时，浏览器在**最外层**加滚动条。

## 目标

- popup **固定高度 600px**（宽度仍 420px 不变）。
- 整体**不出现最外层滚动条**；只有 Markdown 预览区内部可滚动。
- 底部提示（状态/报错）改为**浮层 toast**，覆盖在底部、不占文档流，出现/消失都不改变整体高度。

## 方案

1. **固定高度**：`index.html` 的 body 加 `h-[600px]`（或在根容器设定），`App` 根 `<div>` 改为 `h-full flex flex-col overflow-hidden`。
2. **分区滚动**：
   - header、备注、标签、按钮区都 `shrink-0`。
   - Markdown 预览区从写死的 `h-60` 改为 `flex-1 min-h-0`，内部 `overflow-auto` 自适应剩余空间。
3. **浮层提示**：`status.text` 和 `configIssue` 从文档流末尾移除，改为相对 `App` 根容器 `absolute` 定位的浮层 toast（如 `absolute inset-x-3 bottom-3`），覆盖在按钮区上方，带阴影/背景，不影响布局高度。保留现有 ok/err/muted 配色与进入动画。

## 验收标准

- [ ] popup 高度恒为 600px，无论是否有提示、标签多少。
- [ ] 触发剪藏成功/失败/复制/配置报错时，外层无滚动条，整体高度不变。
- [ ] Markdown 预览区内部仍可独立滚动。
- [ ] 浮层提示出现/消失有平滑动画，不遮挡关键操作（或可短暂遮挡按钮但语义合理）。
- [ ] lint / type-check 通过。

## 非目标

- 不改 Markdown 抽取逻辑、消息协议。
- 不改宽度（保持 420px）。
