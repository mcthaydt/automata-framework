// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { featureDemos, playgroundExamples } from '#src/shared/framework/examples.ts'

// The examples and demos come from the 2D examples package itself (WS3), so a demo that leaves (bodies-2d left
// with physics) leaves the site in the same pull request.
describe('the examples list', () => {
  it('is the 2D examples catalog, with no 3D example', () => {
    const ids = playgroundExamples().map((example) => example.id)
    expect(ids).toContain('core-basic-window')
    expect(ids.filter((id) => id.startsWith('render3d-') || id.startsWith('figures-'))).toEqual([])
  })

  it('gives each example its source and where the playground serves it', () => {
    const rects = playgroundExamples().find((example) => example.id === 'shapes-rects')
    expect(rects).toMatchObject({
      module: 'shapes',
      path: 'shapes/shapes-rects.ts',
      framePage: '/playground/examples/shapes/rects/',
    })
    expect(rects?.source).toContain('// Shows:')
  })

  it('lists the feature demos from their own packages, with no bodies-2d', () => {
    const demos = featureDemos().map((demo) => demo.slug)
    expect(demos).toEqual(['hot-reload', 'primitives'])
    expect(demos).not.toContain('bodies-2d')
  })
})
