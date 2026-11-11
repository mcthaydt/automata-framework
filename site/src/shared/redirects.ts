// The redirects the host answers. The site has no redirect pages (its checks refuse a page that only redirects: a cut
// page gets the 404 page), so an address it keeps for an old link is a rule here, written into the build as `_redirects`
// (`scripts/write-redirects.ts`) and expected live by `scripts/check-deployed.ts`.
import { EDITOR_URL } from './editor-link.ts'

export interface Redirect {
  readonly from: string
  readonly to: string
  /** A redirect status: 301 for an address that has moved for good. */
  readonly status: 301 | 302 | 307 | 308
}

/** The Editor page was cut; its address leads to the editor itself. */
export const REDIRECTS: readonly Redirect[] = [{ from: '/editor', to: EDITOR_URL, status: 301 }]
