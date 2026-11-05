// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { valueImportsOf } from '#src/testing/runtime/import-graph.ts'

describe('frame loop purity', () => {
  it('frame-loop.ts and frames.ts contain no value imports of effect or effect/*', () => {
    const frameLoopPath = fileURLToPath(
      new URL('../../../../../src/shared/runtime/loop/frame-loop.ts', import.meta.url),
    )
    const framesPath = fileURLToPath(
      new URL('../../../../../src/shared/runtime/loop/frames.ts', import.meta.url),
    )

    const loopImports = [...valueImportsOf(frameLoopPath)]
    const framesImports = [...valueImportsOf(framesPath)]

    const allImports = [...loopImports, ...framesImports]
    const effectImports = allImports.filter((pkg) => pkg === 'effect' || pkg.startsWith('effect/'))

    expect(effectImports).toEqual([])
  })
})
