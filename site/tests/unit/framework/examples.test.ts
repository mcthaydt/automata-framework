// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { exampleList, featureDemos } from '../../../src/shared/framework/examples.ts'

// The examples and demos come from the 2D examples package itself (WS3), so a demo that leaves (bodies-2d left
// with physics) leaves the site in the same pull request.
describe('the examples list', () => {
  it('is the 2D examples catalog, with no 3D example', () => {
    const ids = exampleList().map((example) => example.id)
    expect(ids).toContain('core-basic-window')
    expect(ids.filter((id) => id.startsWith('render3d-') || id.startsWith('figures-'))).toEqual([])
  })

  it('gives each example its title line and where the runner serves it', () => {
    expect(exampleList().find((example) => example.id === 'shapes-rects')).toMatchObject({
      module: 'shapes',
      url: '/shapes/rects/',
      path: 'shapes/shapes-rects.ts',
    })
  })

  it('lists the feature demos from their own packages, with no bodies-2d', () => {
    const demos = featureDemos().map((demo) => demo.slug)
    expect(demos).toEqual(['hot-reload', 'primitives'])
    expect(demos).not.toContain('bodies-2d')
  })
})
