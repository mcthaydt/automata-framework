import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import demoUrls from 'virtual:framework/demo-urls'
import { describe, expect, it } from 'vitest'
import { getDemosCatalog } from '#src/features/home/demos.ts'

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

// The runner only asks whether the address it was given is a demo's build. Carrying each demo's whole header text for
// that put 700 bytes of prose into the page script Home preloads, which has a budget (scripts/site-checks/javascript.ts).
describe('the addresses the demo runner may mount', () => {
  it("are the catalogue's build addresses, and nothing else", () => {
    expect(demoUrls).toEqual(getDemosCatalog().map((demo) => demo.bundleUrl))
  })

  it("are all the runner imports, so no demo header text rides in Home's script", () => {
    const runner = readFileSync(resolve(process.cwd(), 'src/features/home/DemoRunner.svelte'), 'utf8')
    expect(runner).toContain("from 'virtual:framework/demo-urls'")
    expect(runner).not.toMatch(/from '\.\/demos'|virtual:framework\/demos/)
  })
})
