// On WebGPU the view's last post pass is drawn to the canvas, and a pass that does that while sampling the scene's depth
// makes the whole frame's command buffer invalid ('Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes
// writable usage and another usage in the same synchronization scope'): the canvas keeps the first frame that was valid, so
// a camera that moves after it never shows. The look therefore ends in a pass that reads colour only.
import { DEPTH_VIEW_PLACEHOLDER, type EffectIO, type Pass3D, type RenderGraph } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { DuelSnapEffect } from '#src/features/look/duel-snap-filter.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { createLookPasses } from '#src/features/look/look-pass.ts'
import { PresentEffect } from '#src/features/look/present-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

/** The passes `effect` adds to a graph, with what each reads. */
function builtBy(effect: Pass3D, webgl = false): { reads: Record<string, unknown> }[] {
  const added: { reads: Record<string, unknown> }[] = []
  const graph = {
    sceneDepth: { id: 'depth' },
    importDepth: (getter: () => unknown) => ({ imported: getter() }),
    addPass: (pass: unknown) => added.push({ reads: (pass as { _reads: Record<string, unknown> })._reads }),
  }
  const renderer = {
    renderPipes: { view3d: { globalSlots: { opaqueDepth: 7 } } },
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

  it('is the snap when only the snap runs', () => {
    const { list, snap, present } = createLookPasses(
      parseLook({ switches: { haze: false } }),
      timeOfDay('day'),
    )
    expect(present).toBeUndefined()
    expect(list).toEqual([snap])
  })

  it('is a present pass when the haze runs, which samples the depth', () => {
    const { list, haze, snap, present } = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(list).toEqual([haze, snap, present])
    expect(present).toBeInstanceOf(PresentEffect)
  })

  it('is a present pass when the outline runs after the snap, and there is only one', () => {
    const { list } = createLookPasses(parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(list.at(-1)).toBeInstanceOf(PresentEffect)
    expect(list.filter((pass) => pass instanceof PresentEffect)).toHaveLength(1)
  })
})
