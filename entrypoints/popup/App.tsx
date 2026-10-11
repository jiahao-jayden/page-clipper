/// <reference types="chrome" />

import {
	ChevronRight,
	Copy,
	Globe,
	Loader2,
	Plus,
	Scissors,
	Settings,
	X,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { StatusNotice, type StatusKind } from "@/components/status-notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type RawCapture, toMarkdown } from "@/lib/normalize";
import {
	getTagHistory,
	normalizeTag,
	normalizeTags,
	saveUsedTags,
} from "@/lib/tags";
import {
	faviconUrlForHost,
	hostnameFromUrl,
	platformDisplayName,
	platformFromUrl,
} from "@/lib/platform";
import { getActiveConnectorState } from "@/lib/connectors";
import { onSettingsChanged } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface StatusState {
	text: string;
	kind: StatusKind;
	detail?: string;
}

interface PageContext {
	hostname: string;
	platform: string;
}

const LABEL = "text-xs font-medium text-foreground/75";

export default function App() {
	const [capture, setCapture] = useState<RawCapture | null>(null);
	const [note, setNote] = useState("");
	const [loading, setLoading] = useState(true);
	const [clipping, setClipping] = useState(false);
	const [status, setStatus] = useState<StatusState>({ text: "", kind: "idle" });
	const [configIssue, setConfigIssue] = useState("");
	const [connectorName, setConnectorName] = useState("");
	const [exportEnabled, setExportEnabled] = useState(false);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [tagHistory, setTagHistory] = useState<string[]>([]);
	const [pageContext, setPageContext] = useState<PageContext>({
		hostname: "",
		platform: "article",
	});
	const [faviconFailed, setFaviconFailed] = useState(false);
	const [coverFailed, setCoverFailed] = useState(false);
	const [showFrontmatter, setShowFrontmatter] = useState(false);
	const [configDismissed, setConfigDismissed] = useState(false);

	const markdown = useMemo(() => {
		if (!capture) return "";
		const effectiveNote = exportEnabled ? note : "";
		const effectiveTags = exportEnabled ? selectedTags : [];
		return toMarkdown({
			...capture,
			user_note: effectiveNote,
			tags: effectiveTags,
		});
	}, [capture, note, selectedTags, exportEnabled]);

	const frontmatter = useMemo(() => {
		const end = markdown.indexOf("\n---\n", 4);
		return end > 0 ? markdown.slice(0, end + 4) : "";
	}, [markdown]);

	const body = capture?.raw_text.trim() ?? "";

	useEffect(() => {
		let alive = true;
		const refresh = async () => {
			try {
				const { connector, connectorConfig, enabled } =
					await getActiveConnectorState();
				if (!alive) return;
				setConnectorName(connector.name);
				setExportEnabled(enabled);
				setConfigIssue(enabled ? connector.validateConfig(connectorConfig) ?? "" : "");
			} catch (e) {
				if (alive) setConfigIssue(String(e));
			}
		};

		void refresh();
		const unsubscribe = onSettingsChanged(() => void refresh());

		return () => {
			alive = false;
			unsubscribe();
		};
	}, []);

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

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const [tab] = await chrome.tabs.query({
					active: true,
					currentWindow: true,
				});
				const url = tab?.url ?? "";
				if (!alive) return;
				setPageContext({
					hostname: hostnameFromUrl(url),
					platform: platformFromUrl(url),
				});
			} catch {
				if (alive) setPageContext({ hostname: "", platform: "article" });
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const res = await chrome.runtime.sendMessage({ type: "EXTRACT" });
				if (!alive) return;
				if (res?.ok && res.data) {
					setCapture(res.data as RawCapture);
				} else {
					setStatus({ text: res?.error ?? "抽取失败", kind: "err" });
				}
			} catch (e) {
				if (alive) setStatus({ text: String(e), kind: "err" });
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (!status.text || status.kind === "idle" || status.kind === "muted") return;
		const ms = status.kind === "ok" ? 3000 : 5000;
		const timer = setTimeout(() => setStatus({ text: "", kind: "idle" }), ms);
		return () => clearTimeout(timer);
	}, [status]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset dismissed state when configIssue changes
	useEffect(() => {
		setConfigDismissed(false);
	}, [configIssue]);

	const faviconUrl = pageContext.hostname
		? faviconUrlForHost(pageContext.hostname)
		: "";

	function openSettingsPage() {
		chrome.runtime.openOptionsPage();
	}

	function addTag(input: string) {
		const tag = normalizeTag(input);
		if (!tag) return;
		setSelectedTags((current) => normalizeTags([...current, tag]));
		setTagInput("");
	}

	function removeTag(tag: string) {
		setSelectedTags((current) => current.filter((item) => item !== tag));
	}

	function handleTagInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
			removeTag(selectedTags[selectedTags.length - 1]);
			return;
		}
		if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
		e.preventDefault();
		addTag(tagInput);
	}

	async function handleClip() {
		if (!capture || !exportEnabled) return;
		if (configIssue) {
			setStatus({ text: `请先完成设置：${configIssue}`, kind: "err" });
			return;
		}
		setClipping(true);
		setStatus({ text: "保存中…", kind: "muted" });
		try {
			const tags = normalizeTags(selectedTags);
			const res = await chrome.runtime.sendMessage({
				type: "CAPTURE",
				data: capture,
				note,
				tags,
			});
			if (res?.ok) {
				setStatus({ text: "已保存", kind: "ok", detail: res.path });
				try {
					const history = await saveUsedTags(tags);
					setTagHistory(history);
				} catch {
					// Tag history is a convenience; a successful clip should stay successful.
				}
			} else {
				if (res?.needsSettings) setConfigIssue(res?.error ?? "连接失败");
				setStatus({ text: res?.error ?? "保存失败", kind: "err" });
			}
		} catch (e) {
			setStatus({ text: String(e), kind: "err" });
		} finally {
			setClipping(false);
		}
	}

	async function handleCopy() {
		if (!capture) return;
		try {
			await navigator.clipboard.writeText(markdown);
			setStatus({ text: "已复制完整 Markdown", kind: "ok" });
			if (exportEnabled) {
				try {
					const tags = normalizeTags(selectedTags);
					const history = await saveUsedTags(tags);
					setTagHistory(history);
				} catch {
					// Tag history is a convenience; a successful copy should stay successful.
				}
			}
		} catch (e) {
			setStatus({ text: `复制失败：${String(e)}`, kind: "err" });
		}
	}

	const platform = capture?.source_platform || pageContext.platform;
	const platformName = platformDisplayName(platform);
	const displayHost = pageContext.hostname.replace(/^www\./, "");
	const cover = capture?.og_image && !coverFailed ? capture.og_image : "";
	const suggestedTags = tagHistory.filter((tag) => !selectedTags.includes(tag));
	const showConfigIssue = exportEnabled && !!configIssue && !configDismissed;

	return (
		<div className="relative flex h-[600px] w-[420px] flex-col overflow-hidden bg-background">
			<header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
				<div className="flex min-w-0 items-center gap-2.5">
					<img src="/icon-128.png" alt="" className="size-6" />
					<div className="flex min-w-0 items-baseline gap-2">
						<h1 className="text-sm font-semibold tracking-tight">
							Page Clipper
						</h1>
						{exportEnabled && connectorName && (
							<span className="truncate text-xs text-muted-foreground">
								→ {connectorName}
							</span>
						)}
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="-mr-1.5 text-muted-foreground hover:text-foreground"
					title="打开设置"
					aria-label="打开设置"
					onClick={openSettingsPage}
				>
					<Settings className="size-4" />
				</Button>
			</header>

			<main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-3">
				{/* Source */}
				<section
					aria-label="来源"
					className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card p-2.5"
				>
					<div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
						{cover ? (
							<img
								src={cover}
								alt=""
								className="size-full object-cover"
								onError={() => setCoverFailed(true)}
							/>
						) : faviconUrl && !faviconFailed ? (
							<img
								src={faviconUrl}
								alt=""
								className="size-5"
								onError={() => setFaviconFailed(true)}
							/>
						) : (
							<Globe className="size-5 text-muted-foreground" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						{loading ? (
							<div className="flex flex-col gap-2" aria-hidden>
								<div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
								<div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
							</div>
						) : (
							<>
								<p
									className="line-clamp-2 text-[13px] leading-[18px] font-medium"
									title={capture?.title}
								>
									{capture?.title || "未识别到标题"}
								</p>
								<p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
									<span className="shrink-0 font-medium text-foreground/70">
										{platformName}
									</span>
									{capture?.author && (
										<>
											<span aria-hidden>·</span>
											<span className="truncate">{capture.author}</span>
										</>
									)}
									{displayHost && (
										<>
											<span aria-hidden>·</span>
											<span className="truncate">{displayHost}</span>
										</>
									)}
								</p>
							</>
						)}
					</div>
				</section>

				{/* Preview */}
				<section className="flex min-h-0 flex-1 flex-col gap-1.5">
					<div className="flex shrink-0 items-center justify-between">
						<h2 className={LABEL}>正文预览</h2>
						{body && (
							<span className="text-[11px] tabular-nums text-muted-foreground">
								{body.length.toLocaleString()} 字符
							</span>
						)}
					</div>
					<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/45">
						{loading ? (
							<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								<span className="text-xs">正在抽取页面内容…</span>
							</div>
						) : capture ? (
							<>
								{frontmatter && (
									<div className="border-b border-border">
										<button
											type="button"
											onClick={() => setShowFrontmatter((v) => !v)}
											aria-expanded={showFrontmatter}
											className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
										>
											<ChevronRight
												className={cn(
													"size-3.5 transition-transform duration-150",
													showFrontmatter && "rotate-90",
												)}
											/>
											Frontmatter
										</button>
										{showFrontmatter && (
											<pre className="px-3 pb-2.5 font-mono text-[11px] leading-[18px] whitespace-pre-wrap break-all text-muted-foreground">
												{frontmatter}
											</pre>
										)}
									</div>
								)}
								<div className="px-3 py-2.5 font-mono text-xs leading-5 whitespace-pre-wrap wrap-break-word text-foreground/90">
									{body || (
										<span className="text-muted-foreground">正文为空</span>
									)}
								</div>
							</>
						) : (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								未能抽取内容
							</div>
						)}
					</div>
				</section>

				{exportEnabled && (
					<>
						{/* Note */}
						<section className="flex shrink-0 flex-col gap-1.5">
							<label htmlFor="clip-note" className={LABEL}>
								备注
							</label>
							<Textarea
								id="clip-note"
								rows={1}
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="可选，写入 frontmatter 的 user_note"
								className="min-h-9 max-h-[76px] resize-none bg-background px-3 py-1.5 text-[13px] leading-5 md:text-[13px]"
							/>
						</section>

						{/* Tags */}
						<section className="flex shrink-0 flex-col gap-1.5">
							<label htmlFor="clip-tag" className={LABEL}>
								标签
							</label>
							<div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
								{selectedTags.map((tag) => (
									<span
										key={tag}
										className="inline-flex h-6 items-center gap-0.5 rounded bg-secondary pr-0.5 pl-1.5 text-xs text-secondary-foreground"
									>
										#{tag}
										<button
											type="button"
											onClick={() => removeTag(tag)}
											aria-label={`移除标签 ${tag}`}
											className="grid size-4 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
										>
											<X className="size-3" />
										</button>
									</span>
								))}
								<input
									id="clip-tag"
									value={tagInput}
									onChange={(e) => setTagInput(e.target.value)}
									onKeyDown={handleTagInputKeyDown}
									placeholder={selectedTags.length ? "" : "输入标签，回车添加"}
									className="h-6 min-w-20 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/80"
								/>
							</div>
							{suggestedTags.length > 0 && (
								<div className="flex items-center gap-1.5">
									<span className="shrink-0 text-[11px] text-muted-foreground">
										最近
									</span>
									<div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
										{suggestedTags.map((tag) => (
											<button
												key={tag}
												type="button"
												onClick={() => addTag(tag)}
												className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded border border-dashed border-border px-1.5 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
											>
												<Plus className="size-3" />
												{tag}
											</button>
										))}
									</div>
								</div>
							)}
						</section>
					</>
				)}
			</main>

			<footer className="flex shrink-0 gap-2 border-t border-border bg-card px-4 py-3">
				<Button
					className="flex-1"
					onClick={handleCopy}
					disabled={!capture}
				>
					<Copy className="size-4" />
					复制 Markdown
				</Button>
				{exportEnabled && (
					<Button
						variant="outline"
						className="shrink-0"
						onClick={handleClip}
						disabled={!capture || clipping || !!configIssue}
						title={connectorName ? `保存到 ${connectorName}` : "保存"}
					>
						{clipping ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Scissors className="size-4" />
						)}
						{connectorName ? `保存到 ${connectorName}` : "保存"}
					</Button>
				)}
			</footer>

			{(status.text || showConfigIssue) && (
				<div className="pointer-events-none absolute inset-x-3 bottom-[68px] flex flex-col gap-2">
					{status.text && status.kind !== "idle" && (
						<StatusNotice
							kind={status.kind}
							detail={status.detail}
							onDismiss={
								status.kind === "muted"
									? undefined
									: () => setStatus({ text: "", kind: "idle" })
							}
							className="pointer-events-auto shadow-md animate-in fade-in slide-in-from-bottom-1 duration-200"
						>
							{status.text}
						</StatusNotice>
					)}

					{showConfigIssue && (
						<StatusNotice
							kind="err"
							onDismiss={() => setConfigDismissed(true)}
							action={
								<Button
									type="button"
									variant="outline"
									size="xs"
									className="shrink-0"
									onClick={openSettingsPage}
								>
									去设置
								</Button>
							}
							className="pointer-events-auto items-center shadow-md animate-in fade-in slide-in-from-bottom-1 duration-200 [&_[data-icon]]:mt-0"
						>
							保存前需要完成设置：{configIssue}
						</StatusNotice>
					)}
				</div>
			)}
		</div>
	);
}
