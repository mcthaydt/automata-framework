// This file never imports render-pixi3d/no-eval: a game that imported only render-pixi/no-eval would draw nothing
// under the CSP (S7-Q1), so the renderer refuses to start, saying what to import (review of #241, optional).
import { Cause, Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { testTarget } from '../testing/test-target.js'
import { createPixi3dRenderer } from './create-pixi3d-renderer.js'

describe('createPixi3dRenderer without render-pixi3d/no-eval', () => {
  it('stops with a defect naming the entry to import, before any Pixi app', async () => {
    const scope = Effect.runSync(Scope.make())
    const host = { appendChild: () => undefined } as unknown as HTMLElement
    const exit = await Effect.runPromiseExit(
      Scope.extend(createPixi3dRenderer({ views: {} })(testTarget(host)), scope),
    )
    await Effect.runPromise(Scope.close(scope, Exit.void))
    expect(Exit.isFailure(exit) && String(Cause.squash(exit.cause))).toContain(
      "import '@mcthaydt/automata-render-pixi3d/no-eval'",
    )
  })
})
