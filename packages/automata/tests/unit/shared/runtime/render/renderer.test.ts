import type { StepResult } from '@mcthaydt/automata-sim'
import { Context, Effect, Either, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { RendererUnavailable } from '#src/shared/runtime/boot-error.ts'
import type { FrameInfo } from '#src/shared/runtime/loop/frames.ts'
import { Renderer, type RenderTarget } from '#src/shared/runtime/render/renderer.ts'
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

  it('nullRenderer(log) built inside a scope records apply (with step tick), draw (with alpha), reset, and destroy when scope closes', async () => {
    const log: NullRendererEntry[] = []
    const factory = nullRenderer(log)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const renderer = yield* factory(dummyTarget).pipe(Scope.extend(scope))

      renderer.apply(dummyStepResult(42))
      renderer.draw(dummyFrame(0.75))
      renderer.reset()

      expect(log).toEqual([{ type: 'apply', tick: 42 }, { type: 'draw', alpha: 0.75 }, { type: 'reset' }])

      // Close scope -> triggers destroy finalizer
      yield* Scope.close(scope, Exit.void)
      expect(log).toEqual([
        { type: 'apply', tick: 42 },
        { type: 'draw', alpha: 0.75 },
        { type: 'reset' },
        { type: 'destroy' },
      ])
    }).pipe(Effect.runPromise)
  })

  it('nullRenderer(log, { fail: true }) fails RendererUnavailable{tried: [webgl2]}', async () => {
    const log: NullRendererEntry[] = []
    const factory = nullRenderer(log, { fail: true })

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const either = yield* factory(dummyTarget).pipe(Scope.extend(scope), Effect.either)
      expect(Either.isLeft(either)).toBe(true)
      if (Either.isLeft(either)) {
        expect(either.left).toEqual(new RendererUnavailable({ tried: ['webgl2'] }))
      }
    }).pipe(Effect.runPromise)
  })

  it('the Renderer tag provides the built GameRenderer', async () => {
    const factory = nullRenderer()
    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const renderer = yield* factory(dummyTarget).pipe(Scope.extend(scope))
      const context = Context.make(Renderer, renderer)
      const resolved = Context.get(context, Renderer)
      expect(resolved).toBe(renderer)
    }).pipe(Effect.runPromise)
  })
})
