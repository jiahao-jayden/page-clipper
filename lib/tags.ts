export const TAGS_KEY = 'obsidianWikiClipper.tags.v1'

interface TagStorageShape {
  history?: unknown
}

export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').trim()
}

export function normalizeTags(inputs: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const input of inputs) {
    const tag = normalizeTag(input)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}

export async function getTagHistory(): Promise<string[]> {
  const result = (await chrome.storage.local.get(TAGS_KEY)) as Record<
    string,
    TagStorageShape | undefined
  >
  const value = result[TAGS_KEY]?.history

  if (!Array.isArray(value)) return []

  return normalizeTags(
    value.filter((item): item is string => typeof item === 'string'),
  )
}

export async function saveUsedTags(tags: string[]): Promise<string[]> {
  const used = normalizeTags(tags)
  if (used.length === 0) return getTagHistory()

  const existing = await getTagHistory()
  const next = normalizeTags([...used, ...existing])
  await chrome.storage.local.set({ [TAGS_KEY]: { history: next } })
  return next
}
