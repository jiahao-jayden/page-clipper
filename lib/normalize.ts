export interface RawCapture {
  source_platform: string
  source_id: string
  canonical_url: string
  title: string
  author: string
  captured_at: string
  raw_text: string
  outbound_urls: string[]
  user_note: string
  tags: string[]
}

export function toMarkdown(c: RawCapture): string {
  return `---
source_platform: ${c.source_platform}
source_id: "${c.source_id}"
canonical_url: ${c.canonical_url}
title: "${c.title.replace(/"/g, '\\"')}"
author: ${c.author}
captured_at: ${c.captured_at}
outbound_urls: ${JSON.stringify(c.outbound_urls)}
user_note: "${c.user_note}"
tags: [status/captured, source/${c.source_platform}]
---

${c.raw_text}
`
}

export function slug(str: string): string {
  return str.replace(/https?:\/\/[^/]+\//,'').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60).replace(/^-|-$/g,'')
}
