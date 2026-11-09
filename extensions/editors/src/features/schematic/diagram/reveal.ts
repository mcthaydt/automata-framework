// Brings a mode's box into view inside the diagram's own scroll region. It moves that region only: `scrollIntoView`
// would also scroll the page, which on a phone throws the person off the part of the editor they were using.

/** Scrolls `region` so the box for `mode` sits in its middle; the browser stops at the region's edges. */
export function reveal(region: HTMLElement, mode: string): void {
  const box = region.querySelector(`[data-mode="${CSS.escape(mode)}"]`)
  if (box === null) return
  const room = region.getBoundingClientRect()
  const at = box.getBoundingClientRect()
  region.scrollLeft += at.left + at.width / 2 - (room.left + room.width / 2)
  region.scrollTop += at.top + at.height / 2 - (room.top + room.height / 2)
}
