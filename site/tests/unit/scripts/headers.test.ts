// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEMO_POLICY } from '#src/shared/html/security-headers'
import { headerProblems, headersFile, matchHeaders } from '../../../scripts/site-checks/headers.ts'
import { writeHeaders } from '../../../scripts/write-headers.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A build with one file of each kind the host serves, and the `_headers` the build writes for it. */
function build(): string {
  const root = mkdtempSync(join(tmpdir(), 'headers-'))
  roots.push(root)
  for (const file of [
    'index.html',
    'docs.html',
    'docs/editor.html',
    'llms.txt',
    'sitemap.xml',
    '404.html',
    '.well-known/security.txt',
    'demos/emberwick/index.html',
    'editor/app/index.html',
    'examples.html',
    'examples/shapes-rects.html',
    'playground/examples/shapes-rects/index.html',
    'playground/runtime/define-game-abc.js',
    'playground/assets/sprite.png',
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), 'x')
  }
  writeHeaders(root)
  return root
}

describe('headersFile', () => {
  it('writes one block per pattern, its detach lines first', () => {
    expect(
      headersFile([
        { pattern: '/*', headers: { A: '1', B: '2' } },
        { pattern: '/demos/*', detach: ['A'], headers: { A: '3' } },
      ]),
    ).toBe('/*\n  A: 1\n  B: 2\n\n/demos/*\n  ! A\n  A: 3\n')
  })
})

describe('matchHeaders', () => {
  it('keeps every matching rule’s headers, and both values of one two rules set', () => {
    const file = headersFile([
      { pattern: '/*', headers: { A: '1', B: '2' } },
      { pattern: '/demos/*', headers: { A: '3' } },
    ])
    expect(matchHeaders(file, '/demos/x')).toEqual({ A: ['1', '3'], B: ['2'] })
    expect(matchHeaders(file, '/docs')).toEqual({ A: ['1'], B: ['2'] })
  })

  it('removes a header a later rule detaches from the broader ones', () => {
    const file = headersFile([
      { pattern: '/*', headers: { A: '1' } },
      { pattern: '/demos/*', detach: ['A'], headers: { A: '3' } },
    ])
    expect(matchHeaders(file, '/demos/x')).toEqual({ A: ['3'] })
  })
})

describe('headerProblems', () => {
  it('finds none in a build whose _headers the build wrote', () => {
    expect(headerProblems(build())).toEqual([])
  })

  it('names the path and the header that differ from what the site means to send', () => {
    const root = build()
    writeFileSync(join(root, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n')
    const problems = headerProblems(root)
    expect(problems).toContain(
      '/docs: Strict-Transport-Security should be max-age=86400; includeSubDomains but the host sends nothing',
    )
  })

  it('refuses a header that two rules both set for one path, because the host would send both', () => {
    const root = build()
    writeFileSync(
      join(root, '_headers'),
      headersFile([
        { pattern: '/*', headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } },
        { pattern: '/demos/*', headers: { 'Content-Security-Policy': "default-src 'self'" } },
      ]),
    )
    expect(headerProblems(root).join('\n')).toContain(
      '/demos/emberwick/: Content-Security-Policy arrives twice',
    )
  })

  it('gives a demo page its whole policy, and a site page the frame rule alone', () => {
    const file = writeHeaders(build())
    expect(matchHeaders(file, '/demos/emberwick/')['Content-Security-Policy']).toEqual([DEMO_POLICY])
    expect(matchHeaders(file, '/docs')['Content-Security-Policy']).toEqual(["frame-ancestors 'self'"])
  })

  it('gives the playground’s frames their cross-origin headers, hashed runtime files for good', () => {
    const root = build()
    const file = writeHeaders(root)
    expect(matchHeaders(file, '/playground/runtime/define-game-abc.js')['Cache-Control']).toEqual([
      'public, max-age=31536000, immutable',
    ])
    expect(matchHeaders(file, '/playground/assets/sprite.png')['Cache-Control']).toEqual(['no-cache'])
    expect(matchHeaders(file, '/playground/assets/sprite.png')['Access-Control-Allow-Origin']).toEqual(['*'])
    expect(matchHeaders(file, '/docs')['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
