import type { StepResult } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { RendererUnavailable } from '#src/shared/runtime/boot-error.ts'
import type { FrameInfo } from '#src/shared/runtime/loop/frames.ts'
import type { RenderTarget } from '#src/shared/runtime/render/renderer.ts'
import { type NullRendererEntry, nullRenderer } from '#src/testing/runtime/null-renderer.ts'
import type { GeometryOwner } from '../../../../../src/shared/ui/geometry/geometry-owner.svelte.ts'

describe('renderer interface and nullRenderer', () => {
  const dummyTarget: RenderTarget = {
    host: document.createElement('div'),
    geometry: {} as GeometryOwner,
    assets: { get: () => undefined },
  }

  const dummyStepResult = (tick: number): StepResult => ({
    tick,
    events: [],
    render: { resync: false, added: [], changed: [], removed: [] },
    rejected: [],
  })

  const dummyFrame = (alpha: number): FrameInfo => ({
    alpha,
    frameMs: 16.6,
    paused: false,
  })

  it('nullRenderer(log) records apply (with step tick), draw (with alpha), reset, and destroy on dispose', async () => {
    const log: NullRendererEntry[] = []
    const built = await nullRenderer(log)(dummyTarget)
    if (!built.ok) throw new Error('nullRenderer refused')
    const renderer = built.value

    renderer.apply(dummyStepResult(42))
    renderer.draw(dummyFrame(0.75))
    renderer.reset()

    expect(log).toEqual([{ type: 'apply', tick: 42 }, { type: 'draw', alpha: 0.75 }, { type: 'reset' }])

    renderer.dispose()
    expect(log).toEqual([
      { type: 'apply', tick: 42 },
      { type: 'draw', alpha: 0.75 },
      { type: 'reset' },
      { type: 'destroy' },
    ])
  })

  it('nullRenderer(log, { fail: true }) answers RendererUnavailable{tried: [webgl2]}', async () => {
    const built = await nullRenderer([], { fail: true })(dummyTarget)
    expect(built).toEqual({ ok: false, reason: new RendererUnavailable({ tried: ['webgl2'] }) })
    if (!built.ok && built.reason._tag === 'RendererUnavailable')
      expect(built.reason.tried).toEqual(['webgl2'])
  })
})
