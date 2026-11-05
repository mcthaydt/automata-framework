// Ported from FloorFifty `tests/deploy/root-absolute.test.ts` (SNEKPRTY/FloorFifty 122a220).
// Inside Ruken the game is served from `https://<game-origin>/b/<buildId>/`, so `/fonts/x.woff2` is the game
// origin's root: a 404, and a font that silently falls back.

import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findRootAbsoluteReferences } from '#src/shared/ship/prepare/root-absolute.ts'

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

  it('finds an unquoted root-absolute attribute and each root-absolute srcset candidate', () => {
    expect(found({ 'index.html': '<script type=module src=/build/index.js></script>' })).toEqual([
      'index.html: src=/build/index.js',
    ])
    expect(
      found({ 'index.html': '<img srcset="icons/a.png 1x, /icons/a@2x.png 2x" src="icons/a.png">' }),
    ).toEqual(['index.html: /icons/a@2x.png'])
    expect(found({ 'index.html': '<img srcset="icons/a.png 1x, icons/a@2x.png 2x">' })).toEqual([])
  })

  it("finds a JSON asset (a Pixi spritesheet, a manifest) that names one of the build's files from the root", () => {
    expect(
      found({ 'assets/hero.json': '{"frames":{},"meta":{"image":"/assets/hero.png","scale":"1"}}' }),
    ).toEqual(['assets/hero.json: "/assets/hero.png"'])
    expect(found({ 'assets/hero.json': '{"meta":{"image":"hero.png","app":"/"}}' })).toEqual([])
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

  it('reads markup, not text: prose, comments and data URIs are not references', () => {
    expect(
      found({
        'index.html': [
          '<img srcset="data:image/jpeg;base64,/9j/4AAQSkZJRg==, icons/a@2x.png 2x" src="icons/a.png">',
          '<p>Set src=/fonts/x.woff2 or href="/icons/a.png" in your config.</p>',
          '<!-- <script src="/build/old.js"></script> -->',
        ].join(''),
      }),
    ).toEqual([])
    expect(
      found({
        'build/index.js':
          '// fetch("/assets/x.json")\n/* load("/fonts/y.woff2") */\nconst ok = "assets/x.json"',
      }),
    ).toEqual([])
    expect(found({ 'build/index.css': '/* url(/fonts/x.woff2) */ a { color: red }' })).toEqual([])
  })

  it('reads JS strings by parsing: only the start of a template literal counts', () => {
    expect(
      found({ 'build/index.js': 'const a = `${base}/assets/x.png`; const b = `/assets/${name}.png`' }),
    ).toEqual(['build/index.js: `/assets/${...}`'])
    expect(found({ 'build/index.cjs': 'module.exports = require("/assets/x.cjs")' })).toEqual([
      'build/index.cjs: "/assets/x.cjs"',
    ])
  })

  it('finds references inside inline scripts, import maps, style attributes and meta tags', () => {
    expect(
      found({
        'index.html': [
          '<script>fetch("/assets/x.json")</script>',
          '<script type="importmap">{"imports":{"x":"/build/x.js"}}</script>',
          '<div style="background: url(/icons/a.png)"></div>',
          '<meta property="og:image" content="/icons/og.png">',
          '<meta name="description" content="/ a quiet game">',
        ].join(''),
      }),
    ).toEqual([
      'index.html: "/assets/x.json"',
      'index.html: "/build/x.js"',
      'index.html: url(/icons/a.png)',
      'index.html: content="/icons/og.png"',
    ])
  })

  it('finds svg hrefs, a single unquoted srcset, imagesrcset and CSS image-set', () => {
    expect(
      found({
        'index.html': [
          '<svg><use href="/icons/s.svg#a"/><image xlink:href="/icons/b.png"/></svg>',
          '<img srcset=/icons/c.png>',
          '<link rel=preload as=image imagesrcset="/icons/d.png 1x, icons/d@2x.png 2x">',
        ].join(''),
      }),
    ).toEqual([
      'index.html: href="/icons/s.svg#a"',
      'index.html: xlink:href="/icons/b.png"',
      'index.html: /icons/c.png',
      'index.html: /icons/d.png',
    ])
    expect(
      found({ 'build/index.css': 'a { background: image-set("/icons/a.png" 1x, "icons/b.png" 2x) }' }),
    ).toEqual(['build/index.css: "/icons/a.png"'])
  })

  it('looks inside a symlinked folder', () => {
    const dist = build({})
    const elsewhere = mkdtempSync(join(tmpdir(), 'ship-root-absolute-linked-'))
    writeFileSync(join(elsewhere, 'app.js'), 'load("/assets/hero.png")')
    symlinkSync(elsewhere, join(dist, 'linked'))
    expect(
      findRootAbsoluteReferences(dist).map((reference) => `${reference.file}: ${reference.reference}`),
    ).toEqual(['linked/app.js: "/assets/hero.png"'])
  })

  it('reports a script it cannot parse instead of passing it', () => {
    expect(found({ 'build/index.js': 'fetch("/assets/x"); }}}}' })).toEqual([
      expect.stringMatching(/^build\/index\.js: could not be parsed: /),
    ])
    expect(found({ 'index.html': '<script>fetch("/assets/x"); }}}}</script>' })).toEqual([
      expect.stringMatching(/^index\.html: could not be parsed: /),
    ])
  })

  it('reads .svg and .htm files and extensions in any case', () => {
    expect(
      found({
        'icons/sprite.svg': '<svg xmlns="http://www.w3.org/2000/svg"><image href="/icons/a.png"/></svg>',
        'about.htm': '<img src="/icons/b.png">',
        'build/APP.JS': 'load("/assets/c.png")',
        'build/MAIN.CSS': 'a { background: url(/icons/d.png) }',
      }),
    ).toEqual([
      'about.htm: src="/icons/b.png"',
      'build/APP.JS: "/assets/c.png"',
      'build/MAIN.CSS: url(/icons/d.png)',
      'icons/sprite.svg: href="/icons/a.png"',
    ])
  })

  it('skips a dangling symlink instead of failing', () => {
    const dist = build({})
    symlinkSync(join(dist, 'missing.js'), join(dist, 'dangling.js'))
    expect(findRootAbsoluteReferences(dist)).toEqual([])
  })
})
