/// <reference types="chrome" />

import { ClipboardCopy, Globe, Loader2, Scissors, Settings } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { validateActiveConnector } from "@/lib/connectors";
import { onSettingsChanged } from "@/lib/settings";

type StatusKind = "idle" | "muted" | "ok" | "err";
interface StatusState {
	text: string;
	kind: StatusKind;
}

interface PageContext {
	hostname: string;
	platform: string;
}

export default function App() {
	const [capture, setCapture] = useState<RawCapture | null>(null);
	const [note, setNote] = useState("");
	const [loading, setLoading] = useState(true);
	const [clipping, setClipping] = useState(false);
	const [status, setStatus] = useState<StatusState>({ text: "", kind: "idle" });
	const [configIssue, setConfigIssue] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [tagHistory, setTagHistory] = useState<string[]>([]);
	const [pageContext, setPageContext] = useState<PageContext>({
		hostname: "",
		platform: "article",
	});
	const [faviconFailed, setFaviconFailed] = useState(false);

	const markdown = useMemo(() => {
		if (!capture) return "";
		return toMarkdown({ ...capture, user_note: note, tags: selectedTags });
	}, [capture, note, selectedTags]);

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const issue = await validateActiveConnector();
				if (alive) setConfigIssue(issue ?? "");
			} catch (e) {
				if (alive) setConfigIssue(String(e));
			}
		})();

		const unsubscribe = onSettingsChanged(() => {
			void (async () => {
				try {
					const issue = await validateActiveConnector();
					if (alive) setConfigIssue(issue ?? "");
				} catch (e) {
					if (alive) setConfigIssue(String(e));
				}
			})();
		});

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
			setStatus({ text: "正在抽取…", kind: "muted" });
			try {
				const res = await chrome.runtime.sendMessage({ type: "EXTRACT" });
				if (!alive) return;
				if (res?.ok && res.data) {
					setCapture(res.data as RawCapture);
					setStatus({ text: "", kind: "idle" });
				} else {
					setStatus({ text: `✗ ${res?.error ?? "抽取失败"}`, kind: "err" });
				}
			} catch (e) {
				if (alive) setStatus({ text: `✗ ${String(e)}`, kind: "err" });
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

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
		if (e.key !== "Enter") return;
		e.preventDefault();
		addTag(tagInput);
	}

	async function handleClip() {
		if (!capture) return;
		if (configIssue) {
			setStatus({ text: `请先完成设置：${configIssue}`, kind: "err" });
			return;
		}
		setClipping(true);
		setStatus({ text: "剪藏中…", kind: "muted" });
		try {
			const tags = normalizeTags(selectedTags);
			const res = await chrome.runtime.sendMessage({
				type: "CAPTURE",
				data: capture,
				note,
				tags,
			});
			if (res?.ok) {
				setStatus({ text: `✓ 已保存到\n${res.path}`, kind: "ok" });
				try {
					const history = await saveUsedTags(tags);
					setTagHistory(history);
				} catch {
					// Tag history is a convenience; a successful clip should stay successful.
				}
			} else {
				if (res?.needsSettings) setConfigIssue(res?.error ?? "连接失败");
				setStatus({ text: `✗ ${res?.error ?? "保存失败"}`, kind: "err" });
			}
		} catch (e) {
			setStatus({ text: `✗ ${String(e)}`, kind: "err" });
		} finally {
			setClipping(false);
		}
	}

	async function handleCopy() {
		if (!capture) return;
		try {
			await navigator.clipboard.writeText(markdown);
			setStatus({ text: "✓ 已复制完整 Markdown", kind: "ok" });
		} catch (e) {
			setStatus({ text: `✗ 复制失败：${String(e)}`, kind: "err" });
		}
	}

	const platform = capture?.source_platform || pageContext.platform;
	const platformName = platformDisplayName(platform);

	const statusClass =
		status.kind === "ok"
			? "rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-primary"
			: status.kind === "err"
				? "rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-destructive"
				: "text-muted-foreground";

	return (
		<div className="flex w-full flex-col bg-background p-5 animate-in fade-in duration-150">
			<header className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2.5">
				<h1 className="text-[13px] font-medium tracking-tight">
					剪藏到 Obsidian
				</h1>
				<div className="flex items-center gap-1.5">
					<Badge variant="secondary" className="gap-1.5 font-normal">
						{faviconUrl && !faviconFailed ? (
							<img
								src={faviconUrl}
								alt=""
								className="size-4.5 rounded-sm"
								onError={() => setFaviconFailed(true)}
							/>
						) : (
							<Globe className="size-4 text-muted-foreground" />
						)}
						<span>{platformName}</span>
					</Badge>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="text-muted-foreground hover:text-foreground"
						title="打开设置"
						onClick={openSettingsPage}
					>
						<Settings className="size-3.5" />
					</Button>
				</div>
			</header>

			<section className="flex flex-col gap-1.5">
				<p className="text-[11px] font-medium text-muted-foreground/70">
					Markdown 预览
				</p>
				<div className="h-60 overflow-auto rounded-lg bg-muted p-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] font-mono text-[13px] leading-6 whitespace-pre-wrap wrap-break-word">
					{loading ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground animate-in fade-in duration-200">
							<Loader2 className="size-5 animate-spin" />
							<span className="text-xs">正在抽取页面内容…</span>
						</div>
					) : markdown ? (
						<span className="animate-in fade-in duration-200">{markdown}</span>
					) : (
						<span className="text-muted-foreground animate-in fade-in duration-200">
							未能抽取内容
						</span>
					)}
				</div>
			</section>

			<section className="mt-4 flex flex-col gap-1.5">
				<p className="text-[11px] font-medium text-muted-foreground/70">备注</p>
				<Textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					placeholder="备注（可选，会写入 frontmatter）"
					className="h-14 resize-y border-border bg-muted/50 text-sm focus:border-border"
				/>
			</section>

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

			<div className="mt-4 flex gap-2 border-t border-border pt-3">
				<Button
					className="flex-1 font-medium"
					onClick={handleClip}
					disabled={!capture || clipping || !!configIssue}
				>
					{clipping ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Scissors className="size-4 animate-in fade-in duration-150" />
					)}
					剪藏
				</Button>
				<Button
					variant="ghost"
					className="shrink-0 text-muted-foreground hover:text-foreground"
					onClick={handleCopy}
					disabled={!capture}
				>
					<ClipboardCopy className="size-4" />
					复制 Markdown
				</Button>
			</div>

			{status.text && (
				<p
					className={`mt-3 min-h-4 text-xs whitespace-pre-wrap break-all animate-in fade-in slide-in-from-bottom-1 duration-200 ${statusClass}`}
				>
					{status.text}
				</p>
			)}

			{configIssue && (
				<div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-destructive animate-in fade-in slide-in-from-bottom-1 duration-200">
					<span className="min-w-0 wrap-break-word">
						剪藏前需要完成设置：{configIssue}
					</span>
					<Button
						type="button"
						variant="outline"
						size="xs"
						className="shrink-0 bg-background"
						onClick={openSettingsPage}
					>
						去设置
					</Button>
				</div>
			)}
		</div>
	);
}
