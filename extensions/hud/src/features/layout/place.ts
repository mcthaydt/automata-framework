// An anchor as the CSS that puts a piece there. It reads the framework's layout variable (`--af-gutter`) and invents no
// breakpoints: the same rule holds at phone size and on a tablet, and the piece's width is capped by the screen's.
import type { HudAnchor } from '../../shared/layout.schema'

const GUTTER = 'var(--af-gutter, 16px)'

/** The edges an anchor pins, and along which axes it centres. */
const PLACES: Readonly<
  Record<HudAnchor, { v: 'top' | 'bottom' | 'centre'; h: 'left' | 'right' | 'centre' }>
> = {
  'top-left': { v: 'top', h: 'left' },
  top: { v: 'top', h: 'centre' },
  'top-right': { v: 'top', h: 'right' },
  left: { v: 'centre', h: 'left' },
  centre: { v: 'centre', h: 'centre' },
  right: { v: 'centre', h: 'right' },
  'bottom-left': { v: 'bottom', h: 'left' },
  bottom: { v: 'bottom', h: 'centre' },
  'bottom-right': { v: 'bottom', h: 'right' },
}

/** The inline style for a piece pinned at `anchor` taking at most `width` CSS pixels (absent: the screen's width). */
export function placeStyle(anchor: HudAnchor, width?: number): string {
  const { v, h } = PLACES[anchor]
  const screen = `calc(100% - 2 * ${GUTTER})`
  const rules = ['position: absolute']
  rules.push(v === 'centre' ? 'top: 50%' : `${v}: ${GUTTER}`)
  rules.push(h === 'centre' ? 'left: 50%' : `${h}: ${GUTTER}`)
  const move = [h === 'centre' ? 'translateX(-50%)' : '', v === 'centre' ? 'translateY(-50%)' : '']
  if (h === 'centre' && v === 'centre') rules.push('transform: translate(-50%, -50%)')
  else if (h === 'centre' || v === 'centre') rules.push(`transform: ${move.find((m) => m !== '')}`)
  rules.push(`max-width: ${width === undefined ? screen : `min(${width}px, ${screen})`}`)
  return `${rules.join('; ')};`
}
