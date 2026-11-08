import { BitmapText, Cache, TextureSource } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPage, pageFamilyIfLoaded } from '#src/features/hud-text/load-page.ts'

// Pixel art makes every new texture nearest by default; an MSDF atlas read that way tears at its edges (audit T5).
describe('loadPage', () => {
  afterEach(() => {
    TextureSource.defaultOptions.scaleMode = 'linear'
  })

  it('registers the page under the family Pixi looks for, with a linear atlas whatever the default is', async () => {
    TextureSource.defaultOptions.scaleMode = 'nearest'
    const family = await loadPage('latin')
    expect(family).toBe('af-hud-latin')
    expect(Cache.has('af-hud-latin-bitmap')).toBe(true)
    const source = Cache.get('af-hud-latin-bitmap').pages[0].texture.source
    expect(source.scaleMode).toBe('linear')
    expect(source.alphaMode).toBe('premultiply-alpha-on-upload')
    expect(source.autoGenerateMipmaps).toBe(false)
  })

  it('shares one promise per page', async () => {
    expect(loadPage('latin')).toBe(loadPage('latin'))
  })

  it('lets a BitmapText measure with the page', async () => {
    const family = await loadPage('latin')
    const text = new BitmapText({ text: 'Bump!', style: { fontFamily: family, fontSize: 32 } })
    expect(text.width).toBeGreaterThan(0)
    text.destroy()
  })

  it('reports a page as loaded only once it is', async () => {
    expect(pageFamilyIfLoaded('cyrillic')).toBeUndefined()
    await loadPage('cyrillic')
    expect(pageFamilyIfLoaded('cyrillic')).toBe('af-hud-cyrillic')
  })
})
