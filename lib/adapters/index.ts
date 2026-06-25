import type { RawCapture } from '../normalize'
import * as twitter from './twitter'
import * as zhihu from './zhihu'
import * as wechat from './wechat'
import * as generic from './generic'

export interface Adapter {
  /** adapter 名称（仅用于调试/日志） */
  name: string
  /** 是否匹配当前 URL */
  matches(url: string): boolean
  /** 抽取为统一的 RawCapture（可同步或异步） */
  extract(url: string): RawCapture | Promise<RawCapture>
}

/**
 * adapter 注册表：按序匹配，命中第一个专门 adapter；
 * 都不命中时回退到 generic（defuddle 通用提取）。
 * 专门 adapter 排在前面，generic 永远兜底放最后。
 */
const adapters: Adapter[] = [
  { name: 'twitter', matches: twitter.matches, extract: twitter.extract },
  { name: 'zhihu', matches: zhihu.matches, extract: zhihu.extract },
  { name: 'wechat', matches: wechat.matches, extract: wechat.extract },
  { name: 'generic', matches: generic.matches, extract: generic.extract },
]

/** 路由：选出第一个匹配的 adapter 并执行抽取。 */
export async function extractForUrl(url: string): Promise<RawCapture> {
  const adapter = adapters.find((a) => a.matches(url)) ?? { extract: generic.extract }
  return await adapter.extract(url)
}
