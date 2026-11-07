import { describe, expect, it } from 'vitest'
import { TOOLS_INSET, usableArea } from './usable-area'

// The part of the plan canvas the tools and the sheet leave clear (task 1.4): the plan is drawn under the tool row and
// the bottom sheet, but the level should be framed in what they leave. jsdom has no layout, so each box is given.

function box(top: number, left: number, width: number, height: number): DOMRect {
  return { top, left, width, height, bottom: top + height, right: left + width, x: left, y: top } as DOMRect
}

function mount(canvas: DOMRect, sheet?: DOMRect): HTMLElement {
  document.body.replaceChildren()
  const host = document.createElement('div')
  host.getBoundingClientRect = () => canvas
  document.body.append(host)
  if (sheet !== undefined) {
    const dock = document.createElement('div')
    dock.dataset.region = 'dock'
    dock.getBoundingClientRect = () => sheet
    document.body.append(dock)
  }
  return host
}

describe('usableArea', () => {
  const canvas = box(53, 264, 869, 662)

  it('leaves the tool row at the top and the sheet at the bottom clear', () => {
    const host = mount(canvas, box(523, 264, 869, 192))
    expect(usableArea(host, { w: 869, h: 662 })).toEqual({
      x: 0,
      y: TOOLS_INSET,
      w: 869,
      h: 470 - TOOLS_INSET,
    })
  })

  it('is the canvas below the tool row when no sheet covers it', () => {
    const host = mount(canvas)
    expect(usableArea(host, { w: 869, h: 662 })).toEqual({
      x: 0,
      y: TOOLS_INSET,
      w: 869,
      h: 662 - TOOLS_INSET,
    })
  })

  it('ignores a sheet that is beside the canvas, not over it', () => {
    const host = mount(canvas, box(53, 0, 264, 662))
    expect(usableArea(host, { w: 869, h: 662 })).toEqual({
      x: 0,
      y: TOOLS_INSET,
      w: 869,
      h: 662 - TOOLS_INSET,
    })
  })

  it('gives up on a sheet that leaves no room, and uses the whole canvas', () => {
    const host = mount(canvas, box(100, 264, 869, 615))
    expect(usableArea(host, { w: 869, h: 662 })).toBeUndefined()
  })
})
