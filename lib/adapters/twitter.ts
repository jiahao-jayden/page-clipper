import type { RawCapture } from '../normalize'
import { defuddleExtract, captureFromDefuddle } from '../extract/pipeline'

/** 判断当前页面是否是单条推文/线程页 */
export function matches(url: string): boolean {
  return /https?:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(url)
}

/**
 * 推文抽取：优先用 defuddle 的 twitter/x extractor（保留图片/线程结构），
 * 失败时回退到读取可见 tweetText 节点拼接，保证至少能存下 URL。
 * 无论哪条路径，都统一补齐 source_platform='x' 与 source_id=推文 id。
 */
export async function extract(url: string): Promise<RawCapture> {
  const source_id = url.match(/status\/(\d+)/)?.[1] ?? ''
  const author = url.match(/(?:x|twitter)\.com\/([^/]+)\/status/)?.[1] ?? ''

  const result = await defuddleExtract(url)
  if (result.markdown) {
    return captureFromDefuddle(url, result, {
      source_platform: 'x',
      source_id,
      author: result.response.author || author,
    })
  }

  return fallbackExtract(url, source_id, author)
}

/** defuddle 抽空时的 DOM 兜底。 */
function fallbackExtract(url: string, source_id: string, author: string): RawCapture {
  const blocks = Array.from(document.querySelectorAll('[data-testid="tweetText"]')).map((el) =>
    (el as HTMLElement).innerText.trim(),
  )
  const raw_text = blocks.length ? blocks.join('\n\n---\n\n') : document.title

  const outbound_urls = Array.from(
    document.querySelectorAll('a[href^="https://t.co/"], a[href^="http"]'),
  )
    .map((a) => (a as HTMLAnchorElement).href)
    .filter((h) => !/(x|twitter)\.com/.test(h))

  return {
    source_platform: 'x',
    source_id,
    canonical_url: url.split('?')[0],
    title: blocks[0]?.slice(0, 80) || `@${author} 的推文`,
    author,
    captured_at: new Date().toISOString(),
    raw_text,
    outbound_urls: [...new Set(outbound_urls)],
    user_note: '',
    tags: [],
  }
}
