// @vitest-environment node
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sceneExamples } from '#src/shared/framework/examples.ts'

const FIXTURES = join(import.meta.dirname, '../../fixtures/scene-examples')

// The 3D example page's reader, proved on fixtures: until the kits are public it returns nothing on the real folder,
// so the site's page list does not change (F3 of the example set; F4 switches it on).
describe('the scene examples reader', () => {
  it('returns the public example with what its page shows, and leaves out the one that imports a private package', () => {
    const found = sceneExamples(FIXTURES, '.')
    expect(found.map((example) => example.id)).toEqual(['scene-lamp'])
    expect(found[0]).toMatchObject({
      id: 'scene-lamp',
      title: 'a fixture scene example that imports only public names',
      controls: 'Tap or press any key; Escape leaves the frame.',
      frameUrl: '/scenes/scene/lamp/index.html',
    })
    expect(found[0]?.shows).toContain("the site's 3D example page on a fixture")
    expect(found[0]?.source).toContain("import { defineGame } from '@automata/framework'")
  })

  // The set is private content, and its own package depends on the 3D runtime, which a stranger cannot install yet:
  // an example that names only the set would ship that runtime's code all the same.
  it("leaves out an example that imports only the set while the set's own package depends on a private package", () => {
    expect(sceneExamples(FIXTURES, '.').map((example) => example.id)).not.toContain('scene-station')
  })

  it('returns nothing over the real 3D examples folder today', () => {
    expect(sceneExamples()).toEqual([])
  })
})
