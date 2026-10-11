import type { RawCapture } from '@/lib/normalize'
import {
  DEFAULT_CONNECTOR_ID,
  getRawConfig,
  saveRawConfig,
  type ClipperConfig,
} from '@/lib/settings'
import { obsidianConnector } from './obsidian'
import type { Connector, ConnectorConfig, SaveResult } from './types'

export type { Connector, ConnectorConfig, ConnectorField, SaveResult } from './types'

/**
 * Connector registry. Add a new save target here (after implementing its
 * module); the options page enumerates this list and the background resolves
 * the active connector from it. Order = display order.
 */
const REGISTRY: Connector[] = [obsidianConnector]

export function listConnectors(): Connector[] {
  return REGISTRY
}

export function getConnector(id: string): Connector | undefined {
  return REGISTRY.find((connector) => connector.id === id)
}

export function resolveConnector(config: ClipperConfig): Connector {
  return (
    getConnector(config.activeConnector) ??
    getConnector(DEFAULT_CONNECTOR_ID) ??
    REGISTRY[0]
  )
}

export function getConnectorConfig(
  config: ClipperConfig,
  connector: Connector,
): ConnectorConfig {
  return connector.normalizeConfig(config.connectors[connector.id])
}

interface ActiveConnectorState {
  config: ClipperConfig
  connector: Connector
  connectorConfig: ConnectorConfig
  /** Whether the optional export-to-app feature is turned on (see {@link ClipperConfig}). */
  enabled: boolean
}

export async function getActiveConnectorState(): Promise<ActiveConnectorState> {
  const config = await getRawConfig()
  const connector = resolveConnector(config)
  return {
    config,
    connector,
    connectorConfig: getConnectorConfig(config, connector),
    enabled: config.exportEnabled,
  }
}

/** Returns a config error string for the active connector, or `null` when valid. */
export async function validateActiveConnector(): Promise<string | null> {
  const { connector, connectorConfig } = await getActiveConnectorState()
  return connector.validateConfig(connectorConfig)
}

export async function saveWithActiveConnector(capture: RawCapture): Promise<SaveResult> {
  const { connector, connectorConfig } = await getActiveConnectorState()
  return connector.save(capture, connectorConfig)
}

export { getRawConfig, saveRawConfig }
