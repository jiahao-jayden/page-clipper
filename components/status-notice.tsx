import { CircleAlert, CircleCheck, Loader2, X } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type StatusKind = "idle" | "muted" | "ok" | "err"

const TONE: Record<Exclude<StatusKind, "idle">, string> = {
  ok: "border-primary/25 bg-[color-mix(in_oklch,var(--primary)_7%,var(--background))] text-foreground [&_[data-icon]]:text-primary",
  err: "border-destructive/25 bg-[color-mix(in_oklch,var(--destructive)_6%,var(--background))] text-foreground [&_[data-icon]]:text-destructive",
  muted: "border-border bg-background text-muted-foreground",
}

/** Inline status line shared by popup toasts and the options page. */
export function StatusNotice({
  kind,
  children,
  detail,
  action,
  onDismiss,
  className,
}: {
  kind: Exclude<StatusKind, "idle">
  children: ReactNode
  /** Secondary line, rendered in mono (e.g. a saved file path). */
  detail?: string
  action?: ReactNode
  onDismiss?: () => void
  className?: string
}) {
  const Icon = kind === "ok" ? CircleCheck : kind === "err" ? CircleAlert : Loader2

  return (
    <div
      role={kind === "err" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-5",
        TONE[kind],
        className,
      )}
    >
      <Icon
        data-icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", kind === "muted" && "animate-spin")}
      />
      <div className="min-w-0 flex-1">
        <p className="wrap-break-word">{children}</p>
        {detail && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={detail}>
            {detail}
          </p>
        )}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭提示"
          className="-mr-1 grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
