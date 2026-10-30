import { describe, expect, it } from 'vitest'
import { playgroundFramePage } from './frame-page.ts'
import { framePolicy } from './frame-policy.ts'

const RUNTIME = {
  automata: '/playground/runtime/automata-LRkvFZ12.js',
  zod: '/playground/runtime/zod-CSYgToI_.js',
  frame: '/playground/runtime/frame-DCEneEhm.js',
  styles: ['/playground/runtime/automata-CBKxHYFl.css'],
}
const SITE = 'https://automata.example'
const ENTRY = { id: 'shapes-rects', title: 'Rectangles <moving>' }

const between = (html: string, start: string, end: string): string => {
  const from = html.indexOf(start) + start.length
  return html.slice(from, html.indexOf(end, from))
}

describe('playgroundFramePage', () => {
  it('maps the two bare imports to the runtime and carries the policy for exactly that import map', () => {
    const html = playgroundFramePage(ENTRY, RUNTIME, SITE)
    const importMap = between(html, '<script type="importmap">', '</script>')
    expect(JSON.parse(importMap)).toEqual({
      imports: { '@mcthaydt/automata': RUNTIME.automata, zod: RUNTIME.zod },
    })
    expect(between(html, 'http-equiv="Content-Security-Policy" content="', '"')).toBe(
      framePolicy(importMap, SITE),
    )
  })

  it("loads the runtime's frame script and styles from the site, and has the game's root", () => {
    const html = playgroundFramePage(ENTRY, RUNTIME, SITE)
    expect(html).toContain(`<script type="module" src="${RUNTIME.frame}"></script>`)
    expect(html).toContain(`<link rel="stylesheet" href="${RUNTIME.styles[0]}" crossorigin="anonymous" />`)
    expect(html).toContain('<main id="game"></main>')
    expect(html).toContain('<title>shapes-rects: Rectangles &lt;moving&gt; (preview)</title>')
  })

  it('has no inline script but the import map', () => {
    const html = playgroundFramePage(ENTRY, RUNTIME, SITE)
    expect(html.match(/<script(?![^>]*\bsrc=)/g)).toEqual(['<script'])
  })

  it('runs nothing for a pending example', () => {
    const html = playgroundFramePage({ ...ENTRY, pending: 'OPEN.1' }, RUNTIME, SITE)
    expect(html).not.toContain('<script')
    expect(html).toContain('pending: OPEN.1')
  })
})
