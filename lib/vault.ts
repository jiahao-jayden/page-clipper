import { normalizeSettings, vaultRequestHeaders, type ClipperSettings } from '@/lib/settings'

export async function writeRaw(
  path: string,
  content: string,
  settings: ClipperSettings,
): Promise<void> {
  const normalized = normalizeSettings(settings)
  const res = await fetch(`${normalized.restUrl}/vault/${path}`, {
    method: 'PUT',
    headers: vaultRequestHeaders(normalized),
    body: content,
  })
  if (!res.ok) throw new Error(`Vault write failed: ${res.status} ${await res.text()}`)
}
