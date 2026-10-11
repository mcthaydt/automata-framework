// Ported from FloorFifty `tests/deploy/root-absolute.test.ts` (SNEKPRTY/FloorFifty 122a220).
// Inside Ruken the game is served from `https://<game-origin>/b/<buildId>/`, so `/fonts/x.woff2` is the game
// origin's root: a 404, and a font that silently falls back.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findRootAbsoluteReferences } from './root-absolute.ts'

/** A built client with these files, and the folders a real one has. */
function build(files: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'ship-root-absolute-'))
  for (const folder of ['assets', 'build', 'fonts', 'icons']) mkdirSync(join(dist, folder))
  writeFileSync(join(dist, 'index.html'), '<!doctype html>')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true })
    writeFileSync(join(dist, path), text)
  }
  return dist
}

const found = (files: Record<string, string>): string[] =>
  findRootAbsoluteReferences(build(files)).map((reference) => `${reference.file}: ${reference.reference}`)

describe('root-absolute references in a built client', () => {
  it('finds none in a build whose paths are all relative', () => {
    expect(
      found({
        'build/index-abc.css':
          '@font-face { src: url(../fonts/fraunces.woff2) format("woff2"); } a { background: url(data:image/png;base64,AAAA); }',
        'build/index-abc.js':
          'const a = "/"; const b = "/health"; const c = `${server}/content`; fetch("assets/manifest.json"); const d = "./assets/x.png";',
        'index.html':
          '<link rel="stylesheet" href="./build/index-abc.css"><script type="module" src="./build/index-abc.js"></script>',
      }),
    ).toEqual([])
  })

  it('finds a stylesheet that names a font from the root', () => {
    expect(found({ 'build/index.css': '@font-face { src: url("/fonts/fraunces.woff2"); }' })).toEqual([
      'build/index.css: url("/fonts/fraunces.woff2")',
    ])
    expect(found({ 'build/index.css': '@font-face { src: url(/fonts/fraunces.woff2); }' })).toHaveLength(1)
  })

  it('finds a page that names its script or style from the root', () => {
    expect(found({ 'index.html': '<script type="module" src="/build/index.js"></script>' })).toEqual([
      'index.html: src="/build/index.js"',
    ])
    expect(found({ 'index.html': '<link rel="icon" href=\'/icons/icon-32.png\'>' })).toHaveLength(1)
  })

  it("finds a script that fetches or loads something of the build's from the root", () => {
    expect(found({ 'build/index.js': 'fetch("/assets/manifest.json")' })).toEqual([
      'build/index.js: "/assets/manifest.json"',
    ])
    expect(found({ 'build/index.js': "new Audio('/assets/production/main-menu.m4a')" })).toHaveLength(1)
    expect(found({ 'build/index.js': 'const font = `/fonts/x.woff2`' })).toHaveLength(1)
  })

  it('does not take a server path, a protocol-relative URL or a bare slash for a build file', () => {
    expect(
      found({
        'build/index.js':
          'const a = "/content"; const b = "//cdn.example/x.js"; const c = "/"; const d = "/telemetry";',
      }),
    ).toEqual([])
    expect(found({ 'build/index.css': 'a { background: url(//cdn.example/x.png); }' })).toEqual([])
    expect(
      found({ 'index.html': '<a href="//example.com/">x</a><a href="https://example.com/fonts/">y</a>' }),
    ).toEqual([])
  })

  it("looks at the build's own folders, whatever they are called", () => {
    const dist = mkdtempSync(join(tmpdir(), 'ship-root-absolute-'))
    mkdirSync(join(dist, 'sprites'))
    writeFileSync(join(dist, 'app.js'), 'load("/sprites/hero.png")')
    expect(findRootAbsoluteReferences(dist).map((reference) => reference.reference)).toEqual([
      '"/sprites/hero.png"',
    ])
  })
})
