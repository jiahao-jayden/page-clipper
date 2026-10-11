import { slug, type RawCapture } from '@/lib/normalize'

export interface ClipperSettings {
  restUrl: string
  restToken: string
  saveBaseDir: string
  pathTemplate: string
}

export const DEFAULT_SETTINGS: ClipperSettings = {
  restUrl: 'http://localhost:27123',
  restToken: '',
  saveBaseDir: '_raw/bookmarks',
  pathTemplate: '{platform}/{date}-{slug}.md',
}

export const SETTINGS_KEY = 'obsidianWikiClipper.settings.v1'
export const DEFAULT_CONNECTOR_ID = 'obsidian'
export const STORAGE_UNAVAILABLE_MESSAGE = '扩展存储不可用，请在已安装的扩展环境中打开设置页'
const TEMPLATE_VARIABLES = new Set(['platform', 'date', 'slug'])

/**
 * Persisted connector config: which save target is active plus per-connector
 * settings. Stored under {@link SETTINGS_KEY}. Connector config values are kept
 * as flat string maps so each connector can own its own field shape.
 */
export interface ClipperConfig {
  activeConnector: string
  connectors: Record<string, Record<string, string>>
  /** Whether the optional "save to an app" (e.g. Obsidian) export is enabled. Defaults to `false`. */
  exportEnabled: boolean
}

export function normalizeSettings(settings: Partial<ClipperSettings> = {}): ClipperSettings {
  return {
    restUrl: (settings.restUrl ?? DEFAULT_SETTINGS.restUrl).trim().replace(/\/+$/, ''),
    restToken: (settings.restToken ?? DEFAULT_SETTINGS.restToken).trim(),
    saveBaseDir: trimSlashes(settings.saveBaseDir ?? DEFAULT_SETTINGS.saveBaseDir),
    pathTemplate: trimSlashes(settings.pathTemplate ?? DEFAULT_SETTINGS.pathTemplate),
  }
}

/**
 * Read-with-fallback for the storage schema. Old builds stored flat Obsidian
 * settings (`{ restUrl, restToken, saveBaseDir, pathTemplate }`) under the same
 * key; wrap them into the Obsidian connector so previously saved config is not
 * dropped.
 */
export function migrateConfig(stored: unknown): ClipperConfig {
  if (stored && typeof stored === 'object' && 'connectors' in stored) {
    const config = stored as Partial<ClipperConfig>
    return {
      activeConnector: config.activeConnector || DEFAULT_CONNECTOR_ID,
      connectors: { ...(config.connectors ?? {}) },
      exportEnabled: config.exportEnabled ?? false,
    }
  }

  const legacy = (stored ?? {}) as Partial<ClipperSettings>
  const hasLegacy = ['restUrl', 'restToken', 'saveBaseDir', 'pathTemplate'].some(
    (key) => key in legacy,
  )
  return {
    activeConnector: DEFAULT_CONNECTOR_ID,
    connectors: hasLegacy
      ? { [DEFAULT_CONNECTOR_ID]: legacy as Record<string, string> }
      : {},
    // Old flat-settings installs are migrated with export left off; their connection
    // fields are preserved so re-enabling needs no re-entry.
    exportEnabled: false,
  }
}

export async function getRawConfig(): Promise<ClipperConfig> {
  const storage = getLocalStorage()
  const stored = await storage.get(SETTINGS_KEY)
  return migrateConfig(stored[SETTINGS_KEY])
}

export async function saveRawConfig(config: ClipperConfig): Promise<void> {
  const storage = getLocalStorage()
  await storage.set({ [SETTINGS_KEY]: config })
}

export function onSettingsChanged(listener: () => void): () => void {
  const storage = getChromeStorage()
  const onChanged = storage?.onChanged
  if (!onChanged) {
    return () => {}
  }

  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      listener()
    }
  }

  onChanged.addListener(handleStorageChange)
  return () => onChanged.removeListener(handleStorageChange)
}

export function validateSettings(settings: ClipperSettings): string | null {
  if (!settings.restUrl) return '请填写 Obsidian REST URL'
  if (!isHttpUrl(settings.restUrl)) return 'Obsidian REST URL 必须是有效的 http(s) 地址'
  if (!settings.restToken) return '请填写 Obsidian REST API 密钥'
  if (!settings.saveBaseDir) return '请填写保存基础目录'
  if (!settings.pathTemplate) return '请填写路径模板'
  return validatePathTemplate(settings.pathTemplate)
}

export function buildCapturePath(capture: RawCapture, settings: ClipperSettings): string {
  const normalized = normalizeSettings(settings)
  const date = capture.captured_at.slice(0, 10)
  const vars: Record<string, string> = {
    platform: capture.source_platform,
    date,
    slug: slug(capture.source_id || capture.canonical_url),
  }
  const rendered = normalized.pathTemplate.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    return vars[key] ?? ''
  })

  return joinPath(normalized.saveBaseDir, rendered)
}

export async function testVaultConnection(settings: ClipperSettings): Promise<void> {
  const normalized = normalizeSettings(settings)
  const validationError = validateSettings(normalized)
  if (validationError) throw new Error(validationError)

  const res = await fetch(`${normalized.restUrl}/`, {
    method: 'GET',
    headers: authHeaders(normalized),
  })
  if (!res.ok) {
    throw new Error(`连接测试失败：${res.status} ${await res.text()}`)
  }
}

export function vaultRequestHeaders(settings: ClipperSettings): HeadersInit {
  return {
    ...authHeaders(settings),
    'Content-Type': 'text/markdown',
  }
}

function authHeaders(settings: ClipperSettings): HeadersInit {
  return settings.restToken ? { Authorization: `Bearer ${settings.restToken}` } : {}
}

function getLocalStorage(): chrome.storage.LocalStorageArea {
  const localStorage = getChromeStorage()?.local
  if (!localStorage) {
    throw new Error(STORAGE_UNAVAILABLE_MESSAGE)
  }
  return localStorage
}

function getChromeStorage(): typeof chrome.storage | undefined {
  return globalThis.chrome?.storage
}

function validatePathTemplate(template: string): string | null {
  const unknown = Array.from(template.matchAll(/\{([^}]+)\}/g))
    .map((match) => match[1])
    .filter((key) => !TEMPLATE_VARIABLES.has(key))
  if (unknown.length > 0) {
    return `路径模板不支持变量：${unknown.map((key) => `{${key}}`).join(', ')}`
  }
  return null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function joinPath(...parts: string[]): string {
  return parts.map(trimSlashes).filter(Boolean).join('/')
}

function trimSlashes(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '')
}
