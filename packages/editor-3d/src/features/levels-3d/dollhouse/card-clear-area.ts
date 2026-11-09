// The part of the 3D canvas that a card or sheet over it leaves clear. The room is drawn on the whole canvas, under them,
// but it is framed in what they leave, so the details card never covers the room (the plan does the same with
// `usableArea`, which only knows the sheets along its bottom edge; this view's card floats at a corner).
import type { Rect, Size } from '@automata/editor/kit/core'

/** The regions of the shell that can float or rise over the canvas. */
const COVERS = '[data-region=inspector], [data-region=dock], [data-region=panel]'
/** A clear area smaller than this in either direction is not worth framing a room in: the whole canvas is used. */
const MIN_SIDE = 120

const area = (rect: Rect): number => rect.w * rect.h

/** The largest of the four bands of `free` that lie wholly above, below, left or right of `cover` (all in canvas px). */
function around(free: Rect, cover: Rect): Rect {
  const [coverRight, coverBottom] = [cover.x + cover.w, cover.y + cover.h]
  const [freeRight, freeBottom] = [free.x + free.w, free.y + free.h]
  const bands: Rect[] = [
    { x: free.x, y: free.y, w: free.w, h: Math.min(cover.y, freeBottom) - free.y },
    { x: free.x, y: Math.max(coverBottom, free.y), w: free.w, h: freeBottom - Math.max(coverBottom, free.y) },
    { x: free.x, y: free.y, w: Math.min(cover.x, freeRight) - free.x, h: free.h },
    { x: Math.max(coverRight, free.x), y: free.y, w: freeRight - Math.max(coverRight, free.x), h: free.h },
  ]
  return bands.reduce((best, band) => (area(band) > area(best) ? band : best))
}

/**
 * The rectangle of the canvas (in its own pixels) that the open cards over it leave clear: the largest band beside each
 * in turn. `undefined` when nothing covers the canvas, or what is left is too small to frame a room in.
 */
export function cardClearArea(host: HTMLElement, size: Size): Rect | undefined {
  const canvas = host.getBoundingClientRect()
  let free: Rect = { x: 0, y: 0, w: size.w, h: size.h }
  let covered = false
  for (const element of host.ownerDocument.querySelectorAll<HTMLElement>(COVERS)) {
    if (element.dataset.open !== 'true') continue
    const box = element.getBoundingClientRect()
    const cover: Rect = { x: box.left - canvas.left, y: box.top - canvas.top, w: box.width, h: box.height }
    const overlaps =
      cover.x < free.x + free.w &&
      cover.x + cover.w > free.x &&
      cover.y < free.y + free.h &&
      cover.y + cover.h > free.y
    if (!overlaps) continue
    free = around(free, cover)
    covered = true
  }
  if (!covered) return undefined
  return free.w < MIN_SIDE || free.h < MIN_SIDE ? undefined : free
}
