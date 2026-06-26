import { toMarkdown } from '@/lib/normalize'
import type { RawCapture } from '@/lib/normalize'
import {
  DEFAULT_SETTINGS,
  buildCapturePath,
  normalizeSettings,
  testVaultConnection,
  validateSettings,
  type ClipperSettings,
} from '@/lib/settings'
import { writeRaw } from '@/lib/vault'
import type { Connector, ConnectorConfig, SaveResult } from './types'

function asSettings(config: ConnectorConfig | undefined): ClipperSettings {
  return normalizeSettings(config as Partial<ClipperSettings> | undefined)
}

function toConfig(settings: ClipperSettings): ConnectorConfig {
  return {
    restUrl: settings.restUrl,
    restToken: settings.restToken,
    saveBaseDir: settings.saveBaseDir,
    pathTemplate: settings.pathTemplate,
  }
}

/**
 * Obsidian Local REST API connector. Wraps the existing settings/vault helpers
 * so behavior and defaults stay identical to the pre-connector flow.
 */
export const obsidianConnector: Connector = {
  id: 'obsidian',
  name: 'Obsidian',
  defaultConfig: toConfig(DEFAULT_SETTINGS),
  fields: [
    {
      key: 'restUrl',
      label: 'Obsidian REST URL',
      type: 'text',
      placeholder: DEFAULT_SETTINGS.restUrl,
      hint: '例如 http://localhost:27123',
      group: 'connection',
    },
    {
      key: 'restToken',
      label: 'REST API 密钥',
      type: 'password',
      placeholder: '输入 API token',
      hint: 'Obsidian Local REST API 的 Bearer token。',
      group: 'connection',
    },
    {
      key: 'saveBaseDir',
      label: '基础目录',
      type: 'text',
      placeholder: DEFAULT_SETTINGS.saveBaseDir,
      group: 'path',
    },
    {
      key: 'pathTemplate',
      label: '路径模板',
      type: 'text',
      placeholder: DEFAULT_SETTINGS.pathTemplate,
      group: 'path',
    },
  ],
  normalizeConfig: (config) => toConfig(asSettings(config)),
  validateConfig: (config) => validateSettings(asSettings(config)),
  testConnection: (config) => testVaultConnection(asSettings(config)),
  save: async (capture: RawCapture, config): Promise<SaveResult> => {
    const settings = asSettings(config)
    await testVaultConnection(settings)
    const path = buildCapturePath(capture, settings)
    await writeRaw(path, toMarkdown(capture), settings)
    return { path }
  },
}
