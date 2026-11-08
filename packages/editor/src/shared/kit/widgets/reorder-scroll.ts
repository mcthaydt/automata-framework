import { autoScrollSpeed } from './reorder-model'

// A reorderable list scrolls itself while a row is dragged near the top or bottom of whatever scrolls it: one
// animation frame at a time, faster the nearer the edge (`autoScrollSpeed`). The list says where the pointer is
// (`pointerY`, or `undefined` once the drag is over) and hears `onscrolled` after each step, because the row under a
// still pointer changes as the list moves beneath it.

interface ScrollArea {
  readonly element: HTMLElement
  readonly top: number
  readonly bottom: number
}

/** The nearest ancestor of `list` that scrolls up and down and has more to show, else the page itself. */
function scrollAreaOf(list: HTMLElement | undefined): ScrollArea | undefined {
  for (let node = list?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
      const box = node.getBoundingClientRect()
      return { element: node, top: box.top, bottom: box.bottom }
    }
  }
  const root = document.scrollingElement
  if (root instanceof HTMLElement && root.scrollHeight > root.clientHeight) {
    return { element: root, top: 0, bottom: window.innerHeight }
  }
  return undefined
}

export interface AutoScroll {
  start(): void
  stop(): void
}

export function autoScroll(
  list: () => HTMLElement | undefined,
  pointerY: () => number | undefined,
  onscrolled: () => void,
): AutoScroll {
  let frame: number | undefined

  function step(): void {
    frame = undefined
    const y = pointerY()
    if (y === undefined) return
    const area = scrollAreaOf(list())
    const speed = area === undefined ? 0 : autoScrollSpeed(y, area.top, area.bottom)
    if (area !== undefined && speed !== 0) {
      area.element.scrollTop += speed
      onscrolled()
    }
    frame = requestAnimationFrame(step)
  }

  return {
    start() {
      if (frame === undefined) frame = requestAnimationFrame(step)
    },
    stop() {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
    },
  }
}
