import { withContentSecurityPolicy } from './csp'
import { hydrateAfterFirstPaint } from './hydration'
import { withoutChunkPreloads } from './preloads'

/**
 * What every prerendered page goes through before it is written (src/hooks.server.ts): the modulepreload hints for
 * shared chunks go (`withoutChunkPreloads`), hydration waits for the first paint (`hydrateAfterFirstPaint`), and the
 * Content-Security-Policy is added last, so its hashes are of the scripts as the page ships them.
 */
export const finishPage = (html: string): string => withContentSecurityPolicy(hydrateAfterFirstPaint(withoutChunkPreloads(html)))
