import { Check, ChevronDown, Loader2, PlugZap, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { StatusNotice, type StatusKind } from '@/components/status-notice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  getRawConfig,
  listConnectors,
  saveRawConfig,
  type ConnectorConfig,
} from '@/lib/connectors'
import { DEFAULT_CONNECTOR_ID, type ClipperConfig } from '@/lib/settings'

interface StatusState {
  text: string
  kind: StatusKind
}

const CONNECTORS = listConnectors()

function buildInitialConfig(raw: ClipperConfig): ClipperConfig {
  const connectors: Record<string, ConnectorConfig> = {}
  for (const connector of CONNECTORS) {
    connectors[connector.id] = connector.normalizeConfig(raw.connectors[connector.id])
  }
  return {
    activeConnector:
      CONNECTORS.find((c) => c.id === raw.activeConnector)?.id ?? DEFAULT_CONNECTOR_ID,
    connectors,
    exportEnabled: raw.exportEnabled,
  }
}

export default function App() {
  const [config, setConfig] = useState<ClipperConfig>(() => ({
    activeConnector: DEFAULT_CONNECTOR_ID,
    connectors: {},
    exportEnabled: false,
  }))
  const [status, setStatus] = useState<StatusState>({ text: '', kind: 'idle' })
  const [switchStatus, setSwitchStatus] = useState<StatusState>({ text: '', kind: 'idle' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [switchSaving, setSwitchSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const raw = await getRawConfig()
        if (alive) setConfig(buildInitialConfig(raw))
      } catch (e) {
        if (alive) setStatus({ text: String(e), kind: 'err' })
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const connector =
    CONNECTORS.find((c) => c.id === config.activeConnector) ?? CONNECTORS[0]
  const connectorConfig = useMemo<ConnectorConfig>(
    () => connector.normalizeConfig(config.connectors[connector.id]),
    [connector, config.connectors],
  )

  const connectionFields = connector.fields.filter((f) => f.group === 'connection')
  const pathFields = connector.fields.filter((f) => f.group === 'path')

  function clearStatus() {
    if (status.kind !== 'idle') setStatus({ text: '', kind: 'idle' })
  }

  function updateField(key: string, value: string) {
    setConfig((current) => ({
      ...current,
      connectors: {
        ...current.connectors,
        [connector.id]: { ...current.connectors[connector.id], [key]: value },
      },
    }))
    clearStatus()
  }

  function selectConnector(id: string) {
    setConfig((current) => ({ ...current, activeConnector: id }))
    clearStatus()
  }

  async function handleExportToggle(next: boolean) {
    const previous = config.exportEnabled
    setSwitchSaving(true)
    // Optimistic UI update; only `exportEnabled` changes locally so unsaved
    // connector/path edits currently in the form stay untouched.
    setConfig((current) => ({ ...current, exportEnabled: next }))
    setSwitchStatus({ text: '', kind: 'idle' })
    try {
      const stored = await getRawConfig()
      await saveRawConfig({ ...stored, exportEnabled: next })

      const storedConnector =
        CONNECTORS.find((c) => c.id === stored.activeConnector) ?? CONNECTORS[0]
      if (next) {
        const normalized = storedConnector.normalizeConfig(stored.connectors[storedConnector.id])
        const issue = storedConnector.validateConfig(normalized)
        setSwitchStatus(
          issue
            ? { text: '已开启，请填写下方连接信息后保存', kind: 'ok' }
            : { text: `已开启保存到 ${storedConnector.name}`, kind: 'ok' },
        )
      } else {
        setSwitchStatus({ text: `已关闭保存到 ${storedConnector.name}`, kind: 'ok' })
      }
    } catch (e) {
      setConfig((current) => ({ ...current, exportEnabled: previous }))
      setSwitchStatus({ text: String(e), kind: 'err' })
    } finally {
      setSwitchSaving(false)
    }
  }

  function resetPathDefaults() {
    setConfig((current) => {
      const next = { ...current.connectors[connector.id] }
      for (const field of pathFields) next[field.key] = connector.defaultConfig[field.key] ?? ''
      return {
        ...current,
        connectors: { ...current.connectors, [connector.id]: next },
      }
    })
    setStatus({ text: '', kind: 'idle' })
  }

  async function handleSave() {
    const normalized = connector.normalizeConfig(config.connectors[connector.id])
    const issue = connector.validateConfig(normalized)
    if (issue) {
      setStatus({ text: issue, kind: 'err' })
      return
    }

    setSaving(true)
    setStatus({ text: '正在保存…', kind: 'muted' })
    try {
      const toSave: ClipperConfig = {
        ...config,
        exportEnabled: true,
        connectors: { ...config.connectors, [connector.id]: normalized },
      }
      await saveRawConfig(toSave)
      setConfig(toSave)
      setStatus({ text: '设置已保存', kind: 'ok' })
    } catch (e) {
      setStatus({ text: String(e), kind: 'err' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection() {
    const normalized = connector.normalizeConfig(config.connectors[connector.id])
    setTesting(true)
    setStatus({ text: '正在测试连接…', kind: 'muted' })
    try {
      await connector.testConnection(normalized)
      setStatus({ text: `连接成功，可以剪藏到 ${connector.name}`, kind: 'ok' })
    } catch (e) {
      setStatus({ text: String(e), kind: 'err' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2.5 px-6">
          <img src="/icon-128.png" alt="" className="size-7" />
          <span className="text-sm font-semibold tracking-tight">Page Clipper</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">设置</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Page Clipper 会把网页抽取为 Markdown 并复制到剪贴板。也可以开启导出，把剪藏直接保存到 Obsidian。
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在读取设置…
          </div>
        ) : (
          <>
            <Section
              title="导出到应用"
              description="开启后 popup 会多一个保存按钮，把剪藏写入 vault。复制功能始终可用。"
            >
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="export-enabled" className="text-[13px] font-medium">
                  保存到 Obsidian
                </label>
                <Switch
                  id="export-enabled"
                  checked={config.exportEnabled}
                  disabled={switchSaving || saving}
                  onCheckedChange={handleExportToggle}
                />
              </div>
              {switchStatus.text && switchStatus.kind !== 'idle' && (
                <StatusNotice kind={switchStatus.kind} className="animate-in fade-in duration-150">
                  {switchStatus.text}
                </StatusNotice>
              )}
            </Section>

            {config.exportEnabled && (
              <>
                <Section title="保存目标" description="剪藏内容将写入这里。未来会支持更多目标（如 Notion）。">
                  <Field id="connector" label="目标应用">
                    <div className="relative">
                      <select
                        id="connector"
                        value={connector.id}
                        onChange={(e) => selectConnector(e.target.value)}
                        className="h-9 w-full appearance-none rounded-md border border-input bg-background pr-9 pl-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                      >
                        {CONNECTORS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </Field>
                </Section>

                {connectionFields.length > 0 && (
                  <Section
                    title="连接"
                    description={`${connector.name} 的访问地址与凭据，仅保存在本机浏览器中。`}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={saving || testing || switchSaving}
                      >
                        {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                        测试连接
                      </Button>
                    }
                  >
                    {connectionFields.map((field) => (
                      <Field key={field.key} id={field.key} label={field.label} hint={field.hint}>
                        <Input
                          id={field.key}
                          type={field.type === 'password' ? 'password' : 'text'}
                          value={connectorConfig[field.key] ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </Field>
                    ))}
                  </Section>
                )}

                {pathFields.length > 0 && (
                  <Section
                    title="保存路径"
                    description={
                      <>
                        支持变量 <Code>{'{platform}'}</Code> <Code>{'{date}'}</Code> <Code>{'{slug}'}</Code>
                      </>
                    }
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={resetPathDefaults}
                      >
                        <RotateCcw className="size-4" />
                        恢复默认
                      </Button>
                    }
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {pathFields.map((field) => (
                        <Field key={field.key} id={field.key} label={field.label} hint={field.hint}>
                          <Input
                            id={field.key}
                            value={connectorConfig[field.key] ?? ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            spellCheck={false}
                            className="font-mono text-[13px]"
                          />
                        </Field>
                      ))}
                    </div>
                    <div className="flex items-baseline gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs">
                      <span className="shrink-0 text-muted-foreground">示例</span>
                      <span className="truncate font-mono text-foreground/80">
                        _raw/bookmarks/x/2026-06-25-example.md
                      </span>
                    </div>
                  </Section>
                )}
              </>
            )}

            <div className="flex flex-col gap-3">
              {status.text && status.kind !== 'idle' && (
                <StatusNotice kind={status.kind} className="animate-in fade-in duration-150">
                  {status.text}
                </StatusNotice>
              )}
              {config.exportEnabled && (
                <div className="flex justify-end">
                  <Button type="button" onClick={handleSave} disabled={saving || testing || switchSaving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    保存设置
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs leading-5 text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground/80">
      {children}
    </code>
  )
}
