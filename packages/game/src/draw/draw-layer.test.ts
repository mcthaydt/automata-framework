import type { PixiStageHooks } from '@mcthaydt/automata-render-pixi'
import { createSim, defineComponent, definePlugin, type Sim } from '@mcthaydt/automata-sim'
import { Container, Graphics, Text } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDrawLayer, type DrawContext, mergeStageHooks } from './draw-layer.ts'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const plugin = definePlugin({ name: 'drawn', defs: [Body] })
const frame = { alpha: 0.5, frameMs: 16, paused: false }
const size = { width: 320, height: 180 }

let sim: Sim | undefined
afterEach(() => {
  sim?.dispose()
  sim = undefined
})

async function oneBody(): Promise<Sim> {
  sim = await createSim({ plugins: [plugin], seed: 1 })
  sim.spawn([[Body, { x: 10, y: 20 }]])
  return sim
}

/** The layer on a bare `ui` container, as `createPixiRenderer` would call `setup`. */
function mounted(draw: (ctx: DrawContext) => void) {
  const ui = new Container()
  const layer = createDrawLayer(draw, size)
  const hooks = layer.setup({ ui })
  const root = ui.children[0] as Container
  const graphics = root.children.find((child) => child instanceof Graphics) as Graphics
  const texts = () => root.children.filter((child) => child instanceof Text) as Text[]
  return { ui, layer, hooks, root, graphics, texts }
}

const boundsOf = (graphics: Graphics) => {
  const b = graphics.getLocalBounds()
  return [b.minX, b.minY, b.maxX, b.maxY]
}

// The immediate-mode draw layer (PRODUCT spec §7, plan D-1, D-2, D-6).
describe('createDrawLayer', () => {
  it('adds one container on the ui layer', () => {
    const { ui, root } = mounted(() => {})
    expect(ui.children).toHaveLength(1)
    expect(root).toBeInstanceOf(Container)
  })

  it('calls nothing while no sim is watched', () => {
    const draw = vi.fn()
    const { hooks } = mounted(draw)
    hooks.draw?.(frame)
    expect(draw).not.toHaveBeenCalled()
  })

  it('calls draw once a frame with the frame, the logical size and a read-only sim', async () => {
    const draw = vi.fn()
    const { hooks, layer } = mounted(draw)
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    hooks.draw?.(frame)
    expect(draw).toHaveBeenCalledTimes(2)
    const ctx = draw.mock.calls[0]?.[0] as DrawContext
    expect(ctx.frame).toEqual(frame)
    expect([ctx.width, ctx.height]).toEqual([320, 180])
    expect(ctx.sim.query(Body)[0]?.get(Body)).toEqual({ x: 10, y: 20 })
    expect((ctx.sim as unknown as Record<string, unknown>).step).toBeUndefined()
  })

  it('draws rects, circles and lines at logical coordinates', async () => {
    const shapes: Record<string, (ctx: DrawContext) => void> = {
      rect: (ctx) => ctx.rect(8, 8, 4, 4, 0xff0000),
      circle: (ctx) => ctx.circle(20, 20, 5, 0x00ff00),
      line: (ctx) => ctx.line(0, 10, 30, 10, 0x0000ff, 2),
    }
    const expected: Record<string, number[]> = {
      rect: [8, 8, 12, 12],
      circle: [15, 15, 25, 25],
      // Pixi pads a stroke's bounds by half its width on every side.
      line: [-1, 9, 31, 11],
    }
    const live = await oneBody()
    for (const [name, draw] of Object.entries(shapes)) {
      const { hooks, layer, graphics } = mounted(draw)
      layer.watch(live)
      hooks.draw?.(frame)
      expect(boundsOf(graphics), name).toEqual(expected[name])
    }
  })

  it('clears every frame, so a shape lasts one frame', async () => {
    let drawn = true
    const { hooks, layer, graphics } = mounted((ctx) => {
      if (drawn) ctx.rect(0, 0, 4, 4, 0xffffff)
    })
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    expect(graphics.context.instructions.length).toBeGreaterThan(0)
    drawn = false
    hooks.draw?.(frame)
    expect(graphics.context.instructions).toHaveLength(0)
  })

  it('reuses one Text per call index and hides the unused ones', async () => {
    let lines = ['score 1', 'tick 0']
    const { hooks, layer, texts } = mounted((ctx) => {
      for (const [i, line] of lines.entries()) ctx.text(line, 4, 4 + i * 10, { color: 0xffffff, size: 8 })
    })
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    const [first, second] = texts()
    expect(texts()).toHaveLength(2)
    expect([first?.text, first?.x, first?.y, first?.visible]).toEqual(['score 1', 4, 4, true])
    expect([second?.text, second?.y]).toEqual(['tick 0', 14])

    lines = ['score 2']
    hooks.draw?.(frame)
    expect(texts()).toHaveLength(2)
    expect(texts()[0]).toBe(first)
    expect([first?.text, first?.visible, second?.visible]).toEqual(['score 2', true, false])
  })

  it('clears and stops drawing when the sim is unwatched', async () => {
    const draw = vi.fn((ctx: DrawContext) => {
      ctx.rect(0, 0, 4, 4, 0xffffff)
      ctx.text('hud', 0, 0)
    })
    const { hooks, layer, graphics, texts } = mounted(draw)
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    layer.watch(undefined)
    hooks.draw?.(frame)
    expect(draw).toHaveBeenCalledTimes(1)
    expect(graphics.context.instructions).toHaveLength(0)
    expect(texts().every((text) => !text.visible)).toBe(true)
  })

  it('lets a throw inside draw propagate (D-5)', async () => {
    const { hooks, layer } = mounted(() => {
      throw new Error('hud bug')
    })
    layer.watch(await oneBody())
    expect(() => hooks.draw?.(frame)).toThrow('hud bug')
  })
})

describe('mergeStageHooks', () => {
  it('calls apply, draw and reset of each, in order, and skips the missing ones', () => {
    const calls: string[] = []
    const a: PixiStageHooks = {
      apply: () => calls.push('a.apply'),
      draw: () => calls.push('a.draw'),
      reset: () => calls.push('a.reset'),
    }
    const b: PixiStageHooks = { draw: () => calls.push('b.draw') }
    const merged = mergeStageHooks(a, undefined, b)
    merged.apply?.({} as never)
    merged.draw?.(frame)
    merged.reset?.()
    expect(calls).toEqual(['a.apply', 'a.draw', 'b.draw', 'a.reset'])
  })
})
