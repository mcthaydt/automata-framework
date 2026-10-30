import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDemosCatalog } from '../src/data/demos'
import { demoPoster, previewSrcset } from '../src/lib/previews'

// QB.3h. The gallery used to start its demo on arrival, which cost /examples 8.8 s of blocking time under Lighthouse's
// mobile throttling, so it waited for Play. WEB.PLAY.5 keeps that lesson in another form (spec §10.2): the /examples
// index runs nothing, and an example page starts its frame only after `load` and when the preview is near the screen
// (tests/examples-pages.test.ts). The posters below still serve DemoRunner on / and /start.
const root = resolve(import.meta.dirname, '..')

describe('demoPoster', () => {
  it('names the preview a demo has, and nothing for a demo without one', () => {
    expect(demoPoster('base-2d')).toBe('/previews/emberwick.jpg')
    expect(demoPoster('hot-reload')).toBe('/previews/hot-reload.jpg')
    expect(demoPoster('ui-primitives')).toBeUndefined()
    expect(demoPoster('no-such-demo')).toBeUndefined()
  })

  it('only names previews that ship, with the WebP sizes the picture element asks for', () => {
    const posters = getDemosCatalog().map(demo => demoPoster(demo.slug)).filter((poster): poster is string => poster !== undefined)
    expect(posters.length).toBeGreaterThan(0)
    for (const poster of posters) {
      expect(() => previewSrcset(poster), poster).not.toThrow()
      const base = poster.replace(/\.jpg$/, '')
      for (const file of [poster, base + '.webp', base + '-640.webp']) expect(existsSync(resolve(root, 'static' + file)), file).toBe(true)
    }
  })
})
