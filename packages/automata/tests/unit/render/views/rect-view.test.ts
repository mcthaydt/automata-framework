import type { RenderRow } from '@mcthaydt/automata-sim'
import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { RenderDeltaConsumer } from '#src/features/render/delta/render-delta-consumer.ts'
import { rect } from '#src/features/render/views/rect-view.ts'

function row(sid: number, components: RenderRow['components']): RenderRow {
  return { sid, components }
}

describe('rect view', () => {
  it('sits at the interpolated position and angle of its component', () => {
    const view = rect({ w: 8, h: 4, color: 0xf9c22b })(row(1, { body: { x: 0, y: 0 } }), 'body')
    if (!view) throw new Error('no view')

    view.update?.({ body: { x: 10, y: 20, angle: 1 } }, { body: { x: 0, y: 0, angle: 0 } }, 0.5)

    expect(view.container.x).toBe(5)
    expect(view.container.y).toBe(10)
    expect(view.container.rotation).toBeCloseTo(0.5, 12)
  })

  it('centres the rectangle on the position by default', () => {
    const view = rect({ w: 8, h: 4, color: 0xffffff })(row(1, { body: { x: 0, y: 0 } }), 'body')
    const bounds = view?.container.getLocalBounds()
    expect([bounds?.minX, bounds?.minY, bounds?.maxX, bounds?.maxY]).toEqual([-4, -2, 4, 2])
  })

  it('anchors at the top-left with anchor 0 and per axis with { x, y }', () => {
    const topLeft = rect({ w: 8, h: 4, color: 0xffffff, anchor: 0 })(row(1, {}), 'body')
    const b1 = topLeft?.container.getLocalBounds()
    expect([b1?.minX, b1?.minY, b1?.maxX, b1?.maxY]).toEqual([0, 0, 8, 4])

    const bottomMiddle = rect({ w: 8, h: 4, color: 0xffffff, anchor: { x: 0.5, y: 1 } })(row(1, {}), 'body')
    const b2 = bottomMiddle?.container.getLocalBounds()
    expect([b2?.minX, b2?.minY, b2?.maxX, b2?.maxY]).toEqual([-4, -4, 4, 0])
  })

  it('follows only the component it was registered under', () => {
    const view = rect({ w: 1, h: 1, color: 0 })(row(1, {}), 'body')
    view?.update?.({ body: { x: 3, y: 4 }, other: { x: 99, y: 99 } }, undefined, 1)
    expect([view?.container.x, view?.container.y]).toEqual([3, 4])
  })

  it('without a component id, follows the first component with x and y', () => {
    const view = rect({ w: 1, h: 1, color: 0 })(row(1, {}))
    view?.update?.({ tag: { team: 1 }, pos: { x: 7, y: 8 } }, undefined, 1)
    expect([view?.container.x, view?.container.y]).toEqual([7, 8])
  })

  it('draws nothing for an entity without a viewed component', () => {
    const world = new Container()
    const consumer = new RenderDeltaConsumer(world, { body: rect({ w: 8, h: 8, color: 0xf9c22b }) })

    consumer.apply({
      resync: false,
      added: [row(1, { other: { x: 1, y: 1 } }), row(2, { body: { x: 4, y: 6 } })],
      changed: [],
      removed: [],
    })

    expect(world.children).toHaveLength(1)
    expect([world.children[0]?.x, world.children[0]?.y]).toEqual([4, 6])
  })

  it('interpolates through the consumer between ticks', () => {
    const world = new Container()
    const consumer = new RenderDeltaConsumer(world, { body: rect({ w: 8, h: 8, color: 0xf9c22b }) })
    consumer.apply({ resync: false, added: [row(1, { body: { x: 0, y: 0 } })], changed: [], removed: [] })
    consumer.apply({ resync: false, added: [], changed: [row(1, { body: { x: 8, y: 16 } })], removed: [] })

    consumer.interpolate(0.25)

    expect([world.children[0]?.x, world.children[0]?.y]).toEqual([2, 4])
  })

  it('destroys its display object', () => {
    const view = rect({ w: 1, h: 1, color: 0 })(row(1, {}), 'body')
    view?.destroy?.()
    expect(view?.container.destroyed).toBe(true)
  })
})
