import { createSim, defineComponent, definePlugin, type Sim } from '@automata/sim'
import { CanvasTextMetrics, Container, Graphics, Text } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDrawLayer, type DrawContext, mergeStageHooks } from '#src/app/draw/draw-layer.ts'
import { loadPage } from '#src/features/hud-text/load-page.ts'
import type { PixiStageHooks } from '#src/features/render/renderer.ts'
import type { HudScale } from '#src/shared/draw/hud-scale.ts'

// jsdom has no 2D canvas and no createImageBitmap: no baked page can load, so every label draws in the fallback face,
// and a fixed advance per letter stands in for the font's metrics. The hud-text tests cover the bitmap path.
vi.mock('#src/features/hud-text/load-page.ts', () => ({
  loadPage: vi.fn(() => Promise.reject(new Error('no pages in jsdom'))),
  pageFamilyIfLoaded: () => undefined,
}))
const SCALE: HudScale = { cssPerLogical: 3, devicePerCss: 1, hostScale: 1 }

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const plugin = definePlugin({ name: 'drawn', defs: [Body] })
const frame = { alpha: 0.5, frameMs: 16, paused: false }
const size = { width: 320, height: 180 }

let sim: Sim | undefined
beforeEach(() => {
  vi.spyOn(CanvasTextMetrics, 'measureText').mockImplementation(((
    value: string,
    style: { fontSize: number },
  ) => ({
    width: [...value].length * 5,
    height: style.fontSize * 1.2,
  })) as never)
})
afterEach(() => {
  sim?.dispose()
  sim = undefined
  vi.restoreAllMocks()
  vi.mocked(loadPage).mockClear()
})

async function oneBody(): Promise<Sim> {
  sim = await createSim({ plugins: [plugin], seed: 1 })
  sim.spawn([[Body, { x: 10, y: 20 }]])
  return sim
}

/** The layer on a bare `ui` container, as `createPixiRenderer` would call `setup`. */
function mounted(draw: (ctx: DrawContext) => void) {
  const ui = new Container()
  const hud = new Container()
  const layer = createDrawLayer(draw, size)
  const hooks = layer.setup({ ui, hud, hudScale: () => SCALE })
  const root = ui.children[0] as Container
  const graphics = root.children.find((child) => child instanceof Graphics) as Graphics
  // One container per label on the hud; its fill is the last Text in it.
  const labels = () => hud.children as Container[]
  const texts = () => labels().map((label) => label.children.filter((c) => c instanceof Text).at(-1) as Text)
  return { ui, hud, layer, hooks, root, graphics, labels, texts }
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

  it('draws text on the hud layer, not in the picture', async () => {
    const { ui, hud, hooks, layer, root } = mounted((ctx) => ctx.text('score 1', 4, 4))
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    expect(hud.children).toHaveLength(1)
    expect(root.children.some((child) => child instanceof Text)).toBe(false)
    expect(ui.children).toEqual([root])
  })

  it('returns the box the text took, at least as tall as the size asked', async () => {
    const boxes: unknown[] = []
    const { hooks, layer } = mounted((ctx) => {
      boxes.push(ctx.text('score 1', 4, 4), ctx.text('x', 4, 20, { size: 16 }))
    })
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    expect(boxes).toEqual([
      { width: 35, height: 8 * 1.2 },
      { width: 5, height: 16 * 1.2 },
    ])
  })

  it('anchors text by its right edge when asked', async () => {
    const { hooks, layer, texts } = mounted(
      (ctx) => void ctx.text('score 1', 100, 4, { anchor: { x: 1, y: 0 } }),
    )
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    expect(texts()[0]?.x).toBe(100 - 35)
  })

  it('draws a shadow only when asked', async () => {
    const { hooks, layer, labels } = mounted((ctx) => {
      ctx.text('a', 0, 0)
      ctx.text('b', 0, 10, { shadow: true })
    })
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    const visibleTexts = (label: Container | undefined) =>
      (label?.children ?? []).filter((child) => child instanceof Text && child.visible).length
    expect([visibleTexts(labels()[0]), visibleTexts(labels()[1])]).toEqual([1, 2])
  })

  it('loads no font and adds nothing to the hud when a draw writes no text', async () => {
    const { hud, hooks, layer } = mounted((ctx) => ctx.rect(0, 0, 4, 4, 0xffffff))
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    expect(hud.children).toHaveLength(0)
    expect(loadPage).not.toHaveBeenCalled()
  })

  it('reuses one label per call index and hides the unused ones', async () => {
    let lines = ['score 1', 'tick 0']
    const { hooks, layer, texts, labels } = mounted((ctx) => {
      for (const [i, line] of lines.entries()) ctx.text(line, 4, 4 + i * 10, { color: 0xffffff, size: 8 })
    })
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    const [first, second] = texts()
    const [firstLabel, secondLabel] = labels()
    expect(texts()).toHaveLength(2)
    expect([first?.text, first?.x, first?.y, first?.visible]).toEqual(['score 1', 4, 4, true])
    expect([second?.text, second?.y]).toEqual(['tick 0', 14])

    lines = ['score 2']
    hooks.draw?.(frame)
    expect(texts()).toHaveLength(2)
    expect(texts()[0]).toBe(first)
    expect([first?.text, firstLabel?.visible, secondLabel?.visible]).toEqual(['score 2', true, false])
  })

  it('clears and stops drawing when the sim is unwatched', async () => {
    const draw = vi.fn((ctx: DrawContext) => {
      ctx.rect(0, 0, 4, 4, 0xffffff)
      ctx.text('hud', 0, 0)
    })
    const { hooks, layer, graphics, labels } = mounted(draw)
    layer.watch(await oneBody())
    hooks.draw?.(frame)
    layer.watch(undefined)
    hooks.draw?.(frame)
    expect(draw).toHaveBeenCalledTimes(1)
    expect(graphics.context.instructions).toHaveLength(0)
    expect(labels().every((label) => !label.visible)).toBe(true)
  })

  // The 3D renderer builds a new Pixi app and calls `setup` again after a lost graphics context ("Try again"); the
  // first app's stage, hud and shapes are destroyed with it.
  it('draws text and shapes on the new stage after a second setup', async () => {
    const stages = () => ({ ui: new Container(), hud: new Container(), hudScale: () => SCALE })
    const layer = createDrawLayer((ctx) => {
      ctx.rect(0, 0, 4, 4, 0xff0000)
      ctx.text('hi', 1, 1)
    }, size)
    layer.watch(await oneBody())

    const first = stages()
    layer.setup(first).draw?.(frame)
    expect(first.hud.children).toHaveLength(1)
    first.hud.destroy({ children: true })
    first.ui.destroy({ children: true })

    const second = stages()
    layer.setup(second).draw?.(frame)
    expect(second.hud.children).toHaveLength(1)
    const root = second.ui.children[0] as Container
    const graphics = root.children.find((child) => child instanceof Graphics) as Graphics
    expect(graphics.destroyed).toBe(false)
    expect(graphics.context.instructions).toHaveLength(1)
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
