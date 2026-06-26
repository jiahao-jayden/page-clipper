import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  getRawConfig,
  listConnectors,
  saveRawConfig,
  type ConnectorConfig,
} from '@/lib/connectors'
import { DEFAULT_CONNECTOR_ID, type ClipperConfig } from '@/lib/settings'

type StatusKind = 'idle' | 'muted' | 'ok' | 'err'

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
  }
}

export default function App() {
  const [config, setConfig] = useState<ClipperConfig>(() => ({
    activeConnector: DEFAULT_CONNECTOR_ID,
    connectors: {},
  }))
  const [status, setStatus] = useState<StatusState>({ text: '', kind: 'idle' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

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

  const statusClass =
    status.kind === 'ok'
      ? 'border-primary/30 bg-primary/5 text-primary'
      : status.kind === 'err'
        ? 'border-red-200 bg-red-50/80 text-destructive'
        : 'border-border bg-muted text-muted-foreground'

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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
      <section className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <header className="mb-6 border-b border-border pb-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Wiki Clipper
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">设置</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            选择保存目标，并配置其连接信息与剪藏文件保存路径。
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在读取设置…
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <Field id="connector" label="保存目标" hint="未来将支持更多目标（如 Notion）。">
              <select
                id="connector"
                value={connector.id}
                onChange={(e) => selectConnector(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {CONNECTORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {connectionFields.map((field) => (
              <Field key={field.key} id={field.key} label={field.label} hint={field.hint}>
                <input
                  id={field.key}
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={connectorConfig[field.key] ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder={field.placeholder}
                />
              </Field>
            ))}

            {pathFields.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">保存路径</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      支持变量：{'{platform}'}、{'{date}'}、{'{slug}'}。
                    </p>
                  </div>
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {pathFields.map((field) => (
                    <Field key={field.key} id={field.key} label={field.label} hint={field.hint}>
                      <input
                        id={field.key}
                        value={connectorConfig[field.key] ?? ''}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        placeholder={field.placeholder}
                      />
                    </Field>
                  ))}
                </div>

                <p className="mt-3 rounded-md bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
                  默认效果：_raw/bookmarks/x/2026-06-25-example.md
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="button" onClick={handleSave} disabled={saving || testing}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                保存设置
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={saving || testing}
              >
                {testing && <Loader2 className="size-4 animate-spin" />}
                测试连接
              </Button>
            </div>

            {status.text && (
              <p className={`rounded-lg border px-3 py-2 text-sm ${statusClass}`}>
                {status.text}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
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
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
