import { describe, expect, it } from 'vitest'
import { withoutChunkPreloads } from '#src/shared/html/preloads.ts'

// QB.3j. SvelteKit lists every module a page's hydration needs as a modulepreload hint, 26 to 29 files and 250 KB built.
// On a slow link the stylesheet and the font wait behind them, which costs the mobile first paint 0.5 to 0.9 s. The
// entry and node modules are small and stay; the shared chunks go.
const ENTRY = '<link rel="modulepreload" href="./_app/immutable/entry/start.BpVvJ_Ju.js">'
const NODE = '<link rel="modulepreload" href="./_app/immutable/nodes/0.CzcxexpS.js">'
const CHUNK = '<link rel="modulepreload" href="./_app/immutable/chunks/l39rUby5.js">'
const STYLES = '<link href="./_app/immutable/assets/0.DBGLDOKE.css" rel="stylesheet">'
const FONT =
  '<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/_app/immutable/assets/geist-latin-wght-normal.BgDaEnEv.woff2"/>'

const head = (...links: string[]) => `<head>\n\t\t${links.join('\n\t\t')}\n  </head>`

describe('withoutChunkPreloads', () => {
  it('removes the modulepreload hints for shared chunks and leaves the entry and node modules', () => {
    const html = head(STYLES, ENTRY, CHUNK, NODE, CHUNK.replace('l39rUby5', 'C1fhbh1j'))
    expect(withoutChunkPreloads(html)).toBe(head(STYLES, ENTRY, NODE))
  })

  it('leaves the stylesheet, the font preload and every other tag alone', () => {
    const html = `<!doctype html><html><head><title>x</title>${STYLES}${FONT}${CHUNK}</head><body><p>${CHUNK}</p></body></html>`
    expect(withoutChunkPreloads(html)).toBe(
      `<!doctype html><html><head><title>x</title>${STYLES}${FONT}</head><body><p></p></body></html>`,
    )
  })

  it('also removes the hints on nested pages, where the paths climb out of the folder', () => {
    const nested = '<link rel="modulepreload" href="../../_app/immutable/chunks/DUrBt0YV.js">'
    expect(withoutChunkPreloads(head(STYLES, nested, NODE))).toBe(head(STYLES, NODE))
  })

  it('removes a hint whose attributes come in the other order', () => {
    const reordered = '<link href="/_app/immutable/chunks/abc.js" rel="modulepreload" />'
    expect(withoutChunkPreloads(head(reordered, ENTRY))).toBe(head(ENTRY))
  })

  it('returns a page with no chunk hints unchanged, and the empty string as it is', () => {
    const html = head(STYLES, ENTRY, NODE)
    expect(withoutChunkPreloads(html)).toBe(html)
    expect(withoutChunkPreloads('')).toBe('')
  })

  it('leaves other kinds of link to a file in the chunks folder alone', () => {
    const stylesheet = '<link rel="stylesheet" href="./_app/immutable/chunks/shared.css">'
    const preload = '<link rel="preload" as="image" href="./_app/immutable/chunks/logo.svg">'
    expect(withoutChunkPreloads(head(stylesheet, preload))).toBe(head(stylesheet, preload))
  })

  it('does not touch a hint for a file outside the chunks folder that happens to mention chunks', () => {
    const other = '<link rel="modulepreload" href="./_app/immutable/entry/chunks-index.js">'
    expect(withoutChunkPreloads(head(other))).toBe(head(other))
  })
})
