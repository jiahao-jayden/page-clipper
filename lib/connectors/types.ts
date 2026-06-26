import type { RawCapture } from '@/lib/normalize'

/** Flat string map of a connector's settings (one entry per {@link ConnectorField}). */
export type ConnectorConfig = Record<string, string>

export interface SaveResult {
  path: string
}

/** A single options-page form field a connector exposes. */
export interface ConnectorField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  hint?: string
  /** UI grouping: connection fields vs. save-path fields. */
  group: 'connection' | 'path'
}

/**
 * A pluggable save target. Obsidian is the only implementation today; new
 * connectors (e.g. Notion) add a module here and register it in `index.ts`
 * without touching the background write flow or the options page.
 */
export interface Connector {
  id: string
  name: string
  fields: ConnectorField[]
  defaultConfig: ConnectorConfig
  normalizeConfig(config: ConnectorConfig | undefined): ConnectorConfig
  /** Returns a human-readable error string, or `null` when the config is valid. */
  validateConfig(config: ConnectorConfig): string | null
  testConnection(config: ConnectorConfig): Promise<void>
  save(capture: RawCapture, config: ConnectorConfig): Promise<SaveResult>
}
