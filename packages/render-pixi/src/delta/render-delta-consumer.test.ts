import type { RenderDelta, RenderRow } from '@mcthaydt/automata-sim'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { type EntityView, RenderDeltaConsumer } from './render-delta-consumer.js'

describe('RenderDeltaConsumer', () => {
  it('mounts entity view to world on added', () => {
    const world = new Container()
    const viewContainer = new Container()
    const updateSpy = vi.fn()
    const destroySpy = vi.fn()

    const view: EntityView = {
      container: viewContainer,
      update: updateSpy,
      destroy: destroySpy,
    }

    const resolver = vi.fn((_row: RenderRow) => view)
    const consumer = new RenderDeltaConsumer(world, resolver)

    const delta: RenderDelta = {
      resync: false,
      added: [
        {
          sid: 101,
          components: {
            position: { x: 10, y: 20 },
          },
        },
      ],
      changed: [],
      removed: [],
    }

    consumer.apply(delta)

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(world.children).toContain(viewContainer)
    expect(updateSpy).toHaveBeenCalledWith({ position: { x: 10, y: 20 } }, { position: { x: 10, y: 20 } }, 1)
  })

  it('supports record-based resolver matching first present component', () => {
    const world = new Container()
    const spriteContainer = new Container()
    const spriteView: EntityView = { container: spriteContainer }
    const spriteFactory = vi.fn(() => spriteView)

    const consumer = new RenderDeltaConsumer(world, {
      sprite: spriteFactory,
    })

    const delta: RenderDelta = {
      resync: false,
      added: [
        {
          sid: 201,
          components: {
            sprite: { texture: 'hero.png' },
          },
        },
      ],
      changed: [],
      removed: [],
    }

    consumer.apply(delta)

    expect(spriteFactory).toHaveBeenCalledTimes(1)
    expect(world.children).toContain(spriteContainer)
  })

  it('advances prev = curr on changed and updates view', () => {
    const world = new Container()
    const viewContainer = new Container()
    const updateSpy = vi.fn()

    const view: EntityView = {
      container: viewContainer,
      update: updateSpy,
    }

    const consumer = new RenderDeltaConsumer(world, () => view)

    // Tick 0: add entity at (0, 0)
    consumer.apply({
      resync: false,
      added: [
        {
          sid: 1,
          components: { pos: { x: 0, y: 0 } },
        },
      ],
      changed: [],
      removed: [],
    })
    updateSpy.mockClear()

    // Tick 1: move to (10, 0)
    consumer.apply({
      resync: false,
      added: [],
      changed: [
        {
          sid: 1,
          components: { pos: { x: 10, y: 0 } },
        },
      ],
      removed: [],
    })

    // Sub-tick interpolation at alpha 0.5
    consumer.interpolate(0.5)

    expect(updateSpy).toHaveBeenCalledWith({ pos: { x: 10, y: 0 } }, { pos: { x: 0, y: 0 } }, 0.5)
  })

  it('freezes stationary entity cache in tick N+1 (advancing prev = curr)', () => {
    const world = new Container()
    const viewContainer = new Container()
    const updateSpy = vi.fn()

    const view: EntityView = {
      container: viewContainer,
      update: updateSpy,
    }

    const consumer = new RenderDeltaConsumer(world, () => view)

    // Tick 0: entity 1 at (0, 0)
    consumer.apply({
      resync: false,
      added: [
        {
          sid: 1,
          components: { pos: { x: 0, y: 0 } },
        },
      ],
      changed: [],
      removed: [],
    })

    // Tick 1: entity 1 moves to (10, 0)
    consumer.apply({
      resync: false,
      added: [],
      changed: [
        {
          sid: 1,
          components: { pos: { x: 10, y: 0 } },
        },
      ],
      removed: [],
    })

    // Tick 2: entity 1 is stationary (absent in changed, absent in added)
    consumer.apply({
      resync: false,
      added: [],
      changed: [],
      removed: [],
    })

    updateSpy.mockClear()

    // Interpolate at alpha 0.5 in Tick 2
    consumer.interpolate(0.5)

    // prev must now equal curr (10, 0), NOT the old (0, 0)
    expect(updateSpy).toHaveBeenCalledWith({ pos: { x: 10, y: 0 } }, { pos: { x: 10, y: 0 } }, 0.5)
  })

  it('removes entity and cleans up view on removed', () => {
    const world = new Container()
    const viewContainer = new Container()
    const destroySpy = vi.fn()

    const view: EntityView = {
      container: viewContainer,
      destroy: destroySpy,
    }

    const consumer = new RenderDeltaConsumer(world, () => view)

    consumer.apply({
      resync: false,
      added: [{ sid: 42, components: { a: 1 } }],
      changed: [],
      removed: [],
    })

    expect(world.children).toContain(viewContainer)

    consumer.apply({
      resync: false,
      added: [],
      changed: [],
      removed: [42],
    })

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(world.children).not.toContain(viewContainer)
  })

  it('resync clears all views and re-mounts added entities', () => {
    const world = new Container()
    const view1Container = new Container()
    const destroy1 = vi.fn()
    const view2Container = new Container()

    const consumer = new RenderDeltaConsumer(world, (row) => {
      if (row.sid === 1) return { container: view1Container, destroy: destroy1 }
      if (row.sid === 2) return { container: view2Container }
      return undefined
    })

    consumer.apply({
      resync: false,
      added: [{ sid: 1, components: {} }],
      changed: [],
      removed: [],
    })

    expect(world.children).toContain(view1Container)

    // Resync: drops sid 1, adds sid 2
    consumer.apply({
      resync: true,
      added: [{ sid: 2, components: {} }],
      changed: [],
      removed: [],
    })

    expect(destroy1).toHaveBeenCalledTimes(1)
    expect(world.children).not.toContain(view1Container)
    expect(world.children).toContain(view2Container)
  })

  it('reset and destroy tear down all active views', () => {
    const world = new Container()
    const viewContainer = new Container()
    const destroySpy = vi.fn()

    const consumer = new RenderDeltaConsumer(world, () => ({
      container: viewContainer,
      destroy: destroySpy,
    }))

    consumer.apply({
      resync: false,
      added: [{ sid: 1, components: {} }],
      changed: [],
      removed: [],
    })

    consumer.reset()

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(world.children.length).toBe(0)
  })
})
