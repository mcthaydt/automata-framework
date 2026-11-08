// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cardClearArea } from '#src/features/levels-3d/dollhouse/card-clear-area.ts'

// The part of the 3D canvas that a card or sheet over it leaves clear, so the room is framed where it can be seen. jsdom
// has no layout, so each box is given.

const box = (top: number, left: number, width: number, height: number): DOMRect =>
  ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top }) as DOMRect

function mount(canvas: DOMRect, covers: { region: string; open: boolean; at: DOMRect }[]): HTMLElement {
  document.body.replaceChildren()
  const host = document.createElement('div')
  host.getBoundingClientRect = () => canvas
  document.body.append(host)
  for (const cover of covers) {
    const element = document.createElement('aside')
    element.dataset.region = cover.region
    element.dataset.open = String(cover.open)
    element.getBoundingClientRect = () => cover.at
    document.body.append(element)
  }
  return host
}

describe('cardClearArea', () => {
  const canvas = box(53, 264, 570, 1049)
  const size = { w: 570, h: 1049 }

  it('is nothing when no card is over the canvas', () => {
    expect(cardClearArea(mount(canvas, []), size)).toBeUndefined()
  })

  it('ignores a card that is closed', () => {
    const card = { region: 'inspector', open: false, at: box(876, 502, 320, 214) }
    expect(cardClearArea(mount(canvas, [card]), size)).toBeUndefined()
  })

  it('leaves the strip above a card that floats at the bottom of the canvas', () => {
    const card = { region: 'inspector', open: true, at: box(876, 502, 320, 214) }
    expect(cardClearArea(mount(canvas, [card]), size)).toEqual({ x: 0, y: 0, w: 570, h: 823 })
  })

  it('leaves the side of a tall card that floats at the edge', () => {
    const card = { region: 'inspector', open: true, at: box(100, 484, 320, 900) }
    expect(cardClearArea(mount(canvas, [card]), size)).toEqual({ x: 0, y: 0, w: 220, h: 1049 })
  })

  it('leaves what is over every card, not under any', () => {
    const cards = [
      { region: 'inspector', open: true, at: box(500, 264, 570, 400) },
      { region: 'dock', open: true, at: box(900, 264, 570, 200) },
    ]
    expect(cardClearArea(mount(canvas, cards), size)).toEqual({ x: 0, y: 0, w: 570, h: 447 })
  })

  it('is nothing when what is left is too small to frame a room in', () => {
    const card = { region: 'inspector', open: true, at: box(53, 264, 570, 1000) }
    expect(cardClearArea(mount(canvas, [card]), size)).toBeUndefined()
  })
})
