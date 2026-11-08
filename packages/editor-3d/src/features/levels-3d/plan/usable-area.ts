// The part of the plan canvas that the tools and the sheet leave clear (task 1.4). The plan is drawn on the whole canvas,
// under the tool row along its top and the sheet that rises over its bottom edge; only the framing of the level
// (`fit`) wants what they leave, so the level is never framed under them. The page reads this as `data-usable` on the
// canvas, and the layout tests draw inside it.
import type { Rect, Size } from '@automata/editor/kit/core'

/** The tool row and the rulers along the top of the canvas, in px: the level is framed below them. */
export const TOOLS_INSET = 56
/** A framing area shorter than this is not worth framing in: the whole canvas is used instead. */
const MIN_HEIGHT = 96

/**
 * The canvas rectangle, in canvas pixels, below the tool row and above any `[data-region=dock]` that covers the
 * canvas's bottom; `undefined` when what is left is too small to frame a level in.
 */
export function usableArea(host: HTMLElement, size: Size): Rect | undefined {
  const canvas = host.getBoundingClientRect()
  let bottom = size.h
  for (const dock of host.ownerDocument.querySelectorAll<HTMLElement>('[data-region=dock]')) {
    const sheet = dock.getBoundingClientRect()
    const over =
      sheet.top < canvas.bottom &&
      sheet.bottom > canvas.top &&
      sheet.left < canvas.right &&
      sheet.right > canvas.left
    // Only a sheet that rises over the canvas's bottom edge takes from it; one beside it takes nothing.
    if (over && sheet.left <= canvas.left && sheet.right >= canvas.right)
      bottom = Math.min(bottom, sheet.top - canvas.top)
  }
  const height = bottom - TOOLS_INSET
  return height < MIN_HEIGHT ? undefined : { x: 0, y: TOOLS_INSET, w: size.w, h: height }
}
