// On WebGPU the view's last post pass is drawn to the canvas, and a pass that does that while sampling the scene's depth
// makes the whole frame's command buffer invalid ('Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes
// writable usage and another usage in the same synchronization scope'): the canvas keeps the first frame that was valid, so
// a camera that moves after it never shows. The look therefore ends in a pass that reads colour only.
import {
  DEPTH_VIEW_PLACEHOLDER,
  type EffectIO,
  FullscreenPass,
  type Pass3D,
  type RenderGraph,
} from '@pixi/3d'
import { Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { DuelSnapEffect } from '#src/features/look/duel-snap-filter.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { createLookPasses } from '#src/features/look/look-pass.ts'
import { PresentEffect } from '#src/features/look/present-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

interface Built {
  readonly reads: Record<string, unknown>
  readonly pass: FullscreenPass
}

/** The passes `effect` adds to a graph, with what each reads; `bound` collects what the renderer's texture system is told to bind. */
function builtBy(effect: Pass3D, webgl = false, bound: [unknown, number][] = []): Built[] {
  const added: Built[] = []
  const graph = {
    sceneDepth: { id: 'depth' },
    importDepth: (getter: () => unknown) => ({ imported: getter() }),
    addPass: (pass: unknown) =>
      added.push({
        reads: (pass as { _reads: Record<string, unknown> })._reads,
        pass: pass as FullscreenPass,
      }),
  }
  const renderer = {
    renderPipes: { view3d: { globalSlots: { opaqueDepth: 7 } } },
    texture: { bind: (texture: unknown, unit: number) => bound.push([texture, unit]) },
    ...(webgl ? { gl: {} } : {}),
  }
  const io = { renderer, input: { id: 'colour' }, output: null }
  ;(effect as unknown as { build(graph: RenderGraph, io: EffectIO): void }).build(graph as never, io as never)
  return added
}

describe('the pass that presents the frame', () => {
  it('the snap reads colour only', () => {
    const passes = builtBy(new DuelSnapEffect(0.04))
    expect(passes).toHaveLength(1)
    expect(Object.keys(passes[0]?.reads ?? {})).toEqual(['color'])
  })

  it('the present pass reads colour, and on WebGPU the empty depth of the engine in place of the scene depth', () => {
    const [pass] = builtBy(new PresentEffect())
    expect(Object.keys(pass?.reads ?? {})).toEqual(['color', 'depth'])
    expect(pass?.reads.depth).toEqual({ imported: DEPTH_VIEW_PLACEHOLDER })
    expect(Object.keys(builtBy(new PresentEffect(), true)[0]?.reads ?? {})).toEqual(['color'])
  })

  // WebGL has no sampled-depth rule, but a texture left bound on a unit is sampled by the next draw whose shader reads every
  // unit (the 2D stage's sprite batch), and the canvas's own depth, attached on the first frame the look presents, is one.
  // WebKit reports it as 'Feedback loop formed between Framebuffer and active Texture'.
  it('on WebGL leaves no texture bound on the first units once it has drawn, so the stage cannot sample the canvas depth', () => {
    const bound: [unknown, number][] = []
    const render = vi.spyOn(FullscreenPass.prototype, 'render').mockImplementation(() => undefined)
    try {
      const [built] = builtBy(new PresentEffect(), true, bound)
      built?.pass.render({} as never)
      expect(render).toHaveBeenCalledOnce()
      expect(bound).toEqual(Array.from({ length: 16 }, (_, unit) => [Texture.EMPTY, unit]))
    } finally {
      render.mockRestore()
    }
  })

  it('on WebGPU leaves the texture units alone', () => {
    const bound: [unknown, number][] = []
    const render = vi.spyOn(FullscreenPass.prototype, 'render').mockImplementation(() => undefined)
    try {
      builtBy(new PresentEffect(), false, bound)[0]?.pass.render({} as never)
      expect(bound).toEqual([])
    } finally {
      render.mockRestore()
    }
  })

  it('is the snap when only the snap runs', () => {
    const { list, snap, present } = createLookPasses(
      parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(present).toBeUndefined()
    expect(list).toEqual([snap])
  })

  it('is a present pass when the haze runs, which samples the depth', () => {
    const { list, haze, grade, snap, present } = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(list).toEqual([haze, grade, snap, present])
    expect(present).toBeInstanceOf(PresentEffect)
  })

  // The grade is off until a mood is set, but a mood can be set after the list is made, and the pass then samples the depth
  // like any other `PostEffect`; the list cannot know, so a grade in it is a reason for a present pass.
  it('is a present pass when only the mood grade is in the list, before the snap', () => {
    const { list, grade, snap, present } = createLookPasses(
      parseLook({ switches: { haze: false } }),
      timeOfDay('day'),
    )
    expect(list).toEqual([grade, snap, present])
    expect(present).toBeInstanceOf(PresentEffect)
  })

  it('is a present pass when the outline runs after the snap, and there is only one', () => {
    const { list } = createLookPasses(parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(list.at(-1)).toBeInstanceOf(PresentEffect)
    expect(list.filter((pass) => pass instanceof PresentEffect)).toHaveLength(1)
  })
})
