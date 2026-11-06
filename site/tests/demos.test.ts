import { describe, expect, it } from 'vitest'
import { getDemosCatalog } from '../src/data/demos'

describe('Demos Catalog', () => {
  it('loads all gallery demos with raylib headers and source code', () => {
    const catalog = getDemosCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    for (const demo of catalog) {
      expect(demo.path).toBeDefined()
      expect(demo.title).toBeDefined()
      expect(demo.shows).toBeDefined()
      expect(demo.controls).toBeDefined()
      expect(demo.packages).toBeInstanceOf(Array)
      expect(demo.packages.length).toBeGreaterThan(0)
      expect(demo.sourceCode.length).toBeGreaterThan(20)
    }
  })
})
