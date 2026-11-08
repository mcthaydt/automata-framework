import { CHARS as CYRILLIC } from './fonts/cyrillic-chars.ts'
import { CHARS as LATIN } from './fonts/latin-chars.ts'

/** The id of a baked font page. `latin` serves en es fr de it pt-BR pl tr; `cyrillic` serves ru uk. */
export type PageId = 'latin' | 'cyrillic'

/** A page's id and every character it can draw. */
export interface PageChars {
  readonly id: PageId
  readonly chars: string
}

/** In the order a string is tried: the page most strings fit comes first. */
export const HUD_PAGES: readonly PageChars[] = [
  { id: 'latin', chars: LATIN },
  { id: 'cyrillic', chars: CYRILLIC },
]
