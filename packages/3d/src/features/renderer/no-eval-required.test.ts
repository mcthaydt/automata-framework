// This file never imports @automata/3d/no-eval: a game that imported only render-pixi/no-eval would draw nothing
// under the CSP (S7-Q1), so the renderer refuses to start, saying what to import (review of #241, optional).
import { describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '../../app/create-renderer.ts'
import { testTarget } from '../../testing/test-target.ts'

describe('createPixi3dRenderer without @automata/3d/no-eval', () => {
  it('throws an error naming the entry to import, before any Pixi app', async () => {
    const host = { appendChild: () => undefined } as unknown as HTMLElement
    await expect(createPixi3dRenderer({ views: {} })(testTarget(host))).rejects.toThrow(
      "import '@automata/3d/no-eval'",
    )
  })
})
