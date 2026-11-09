// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { playgroundFramePage } from '../../../../playground/src/frame-page.ts'
import { framePolicy } from '../../../../playground/src/ruken/frame-policy.ts'

const RUNTIME = {
  automata: '/playground/runtime/automata-LRkvFZ12.js',
  zod: '/playground/runtime/zod-CSYgToI_.js',
  noEval: '/playground/runtime/no-eval-Q1w2e3R4.js',
  frame: '/playground/runtime/frame-DCEneEhm.js',
  styles: ['/playground/runtime/automata-CBKxHYFl.css'],
}
const SITE = 'https://automata.example'
const ENTRY = { id: 'shapes-rects', title: 'Rectangles <moving>', path: 'shapes/shapes-rects.ts' }

const between = (html: string, start: string, end: string): string => {
  const from = html.indexOf(start) + start.length
  return html.slice(from, html.indexOf(end, from))
}

describe('playgroundFramePage', () => {
  it('maps the two bare imports to the runtime and carries the policy for exactly that import map', () => {
    const html = playgroundFramePage(ENTRY, RUNTIME, SITE)
    const importMap = between(html, '<script type="importmap">', '</script>')
    expect(JSON.parse(importMap)).toEqual({
      imports: { '@automata/framework': RUNTIME.automata, zod: RUNTIME.zod },
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

  it("tells the frame the example's file, for stack lines, and its Host: settings, as text it parses", () => {
    const html = playgroundFramePage(
      { ...ENTRY, host: { grant: ['saves'], saves: { best: '"12"' } } },
      RUNTIME,
      SITE,
    )
    const body = between(html, '<body', '>')
    expect(body).toContain('data-example="examples/shapes/shapes-rects.ts"')
    const host = between(body, 'data-host="', '"').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    expect(JSON.parse(host)).toEqual({ grant: ['saves'], saves: { best: '"12"' } })
    expect(between(playgroundFramePage(ENTRY, RUNTIME, SITE), '<body', '>')).not.toContain('data-host')
  })

  // R-6: no-eval runs in a module script of its own, before the frame's: module scripts run in document order, and the
  // frame's chunks would otherwise evaluate before the no-eval code bundled into it.
  it('loads no-eval in its own module script, before the frame script', () => {
    const html = playgroundFramePage(ENTRY, RUNTIME, SITE)
    const noEval = html.indexOf(`<script type="module" src="${RUNTIME.noEval}"></script>`)
    expect(noEval).toBeGreaterThan(-1)
    expect(noEval).toBeLessThan(html.indexOf(`src="${RUNTIME.frame}"`))
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
