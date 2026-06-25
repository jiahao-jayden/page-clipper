const BASE = import.meta.env.VITE_OBSIDIAN_REST_URL ?? 'http://localhost:27123'
const KEY  = import.meta.env.VITE_OBSIDIAN_REST_KEY  ?? ''

export async function writeRaw(path: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/vault/${path}`, {
    method: 'PUT',
    headers: {
      ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
      'Content-Type': 'text/markdown',
    },
    body: content,
  })
  if (!res.ok) throw new Error(`Vault write failed: ${res.status} ${await res.text()}`)
}
