// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkSite } from '../scripts/site-checks'

const ORIGIN = 'https://automata.ruken.com'
const roots: string[] = []

function page(path: string, { body = '<p>Real content.</p>', head = '' } = {}): string {
  return `<!doctype html><html lang="en"><head>
<title>Page</title><meta name="description" content="A page." /><meta property="og:title" content="Page" />
<link rel="canonical" href="${ORIGIN}${path}" /><meta property="og:image" content="${ORIGIN}/social.png" />${head}
</head><body><main id="main"><h1>Page</h1>${body}</main></body></html>`
}

/** A minimal build that passes every rule. Each case below breaks exactly one thing. */
function goodSite(): { root: string; write: (file: string, content: string | Uint8Array) => void } {
  const root = mkdtempSync(join(tmpdir(), 'qb3-site-'))
  roots.push(root)
  const write = (file: string, content: string | Uint8Array) => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>' }))
  write('docs.html', page('/docs'))
  return { root, write }
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('checkSite', () => {
  it('passes a correct build', () => {
    expect(checkSite(goodSite().root)).toEqual([])
  })

  it('still reports a missing link destination', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<a href="/nowhere">Gone</a>' }))
    expect(checkSite(site.root)).toContain('docs.html: missing destination /nowhere')
  })
})
