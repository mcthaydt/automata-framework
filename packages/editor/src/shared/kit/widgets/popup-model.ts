// Where a popover goes (kit spec §4.6): under its trigger if it fits, above it if that has clearly more room, never
// off the screen. Pure, so the rules are tested without a layout engine; the popup reads the rectangles.

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Placement {
  readonly left: number
  readonly top: number
  /** The trigger's width: a popover is never narrower than the thing that opened it. */
  readonly minWidth: number
  /** The room on the chosen side. The popover scrolls inside this when it is taller. */
  readonly maxHeight: number
  readonly above: boolean
}

export interface PlacementOptions {
  /** Space between the trigger and the popover. Default 4. */
  readonly gap?: number
  /** Space kept clear of every screen edge. Default 8. */
  readonly margin?: number
}

export function placePopover(
  anchor: Rect,
  size: Size,
  viewport: Size,
  options: PlacementOptions = {},
): Placement {
  const gap = options.gap ?? 4
  const margin = options.margin ?? 8
  const roomBelow = viewport.height - margin - (anchor.bottom + gap)
  const roomAbove = anchor.top - gap - margin
  const above = size.height > roomBelow && roomAbove > roomBelow
  const room = above ? roomAbove : roomBelow
  const height = Math.min(size.height, room)
  const top = above ? anchor.top - gap - height : anchor.bottom + gap
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - margin - size.width))
  return { left, top, minWidth: anchor.width, maxHeight: room, above }
}
