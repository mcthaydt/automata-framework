import { describe, expect, it } from 'vitest'
import { getDemosCatalog } from '../src/features/home/demos'

// The demos come from the workspace: Emberwick and every feature demo with its own package (WS3).
describe('Demos Catalog', () => {
  it('lists Emberwick and the feature demos, each with its header and where its build is served', () => {
    const catalog = getDemosCatalog()
    expect(catalog.map((demo) => demo.slug)).toEqual(['emberwick', 'hot-reload', 'primitives'])
    for (const demo of catalog) {
      expect(demo.title.length, demo.slug).toBeGreaterThan(5)
      expect(demo.shows.length, demo.slug).toBeGreaterThan(20)
      expect(demo.bundleUrl).toBe(`/demos/${demo.slug}/index.html`)
    }
  })
})
