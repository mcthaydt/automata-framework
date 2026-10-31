import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineShipConfig } from '@mcthaydt/automata-ship'
import { Effect } from 'effect'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'
import { scanForDataUrls } from './data-url-scan.ts'
import { headersFor } from './ruken/csp-probe-live.ts'

// The `data-urls` step's scan (DX.5a). The real-build cases build a game-like page with Vite itself, so a Vite that
// changes how it writes an inlined asset fails here instead of letting the scan go blind.

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

interface BuiltPage {
  readonly chunks: { file: string; code: string }[]
  /** The file names of the assets the build emitted as files. */
  readonly assetFiles: string[]
}

/** A page that loads a 278-byte sheet and a tiny JSON the way AF does: `new URL('./file', import.meta.url)`. */
async function buildPage(buildOptions: Record<string, unknown> = {}): Promise<BuiltPage> {
  const root = mkdtempSync(join(tmpdir(), 'automata-check-data-urls-'))
  roots.push(root)
  writeFileSync(join(root, 'sheet.png'), new Uint8Array(278).fill(7))
  writeFileSync(join(root, 'room.json'), '{"w":4}')
  writeFileSync(
    join(root, 'main.js'),
    [
      "const sheet = new URL('./sheet.png', import.meta.url).href",
      "const room = new URL('./room.json', import.meta.url)",
      'fetch(sheet).then(() => fetch(room))',
    ].join('\n'),
  )
  writeFileSync(join(root, 'index.html'), '<!doctype html><script type="module" src="./main.js"></script>')
  const results = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: { write: false, ...buildOptions },
  })
  const output = (Array.isArray(results) ? results : [results]).flatMap((result) =>
    'output' in result ? result.output : [],
  )
  return {
    chunks: output.flatMap((item) =>
      item.type === 'chunk' ? [{ file: `dist/${item.fileName}`, code: item.code }] : [],
    ),
    assetFiles: output.flatMap((item) => (item.type === 'asset' ? [item.fileName] : [])),
  }
}

describe('scanForDataUrls', () => {
  it("finds each asset Vite's default inlined as a data: URL, at its new URL, with the MIME type and the fix", async () => {
    const { chunks } = await buildPage()
    const findings = chunks.flatMap(({ file, code }) => scanForDataUrls(file, code))
    expect(findings.map((finding) => finding.rule)).toEqual(['data-url', 'data-url'])
    expect(findings.map((finding) => /\((\S+)\)/.exec(finding.message)?.[1])).toEqual([
      'image/png',
      'application/json',
    ])
    for (const finding of findings) {
      expect(finding.file).toMatch(/^dist\/assets\/.+\.js$/)
      expect(finding.message).toContain("Ruken's CSP")
      expect(finding.message).toContain('build.assetsInlineLimit: 0')
      const code = chunks.find((chunk) => chunk.file === finding.file)?.code ?? ''
      const line = code.split('\n')[finding.line - 1] ?? ''
      expect(line.slice(finding.col - 1)).toMatch(/^new URL\(/)
    }
  }, 90_000)

  it('finds nothing when the build emits every asset as a file (assetsInlineLimit: 0)', async () => {
    const { chunks, assetFiles } = await buildPage({ assetsInlineLimit: 0 })
    expect(chunks.flatMap(({ file, code }) => scanForDataUrls(file, code))).toEqual([])
    // The clean result comes from the assets being files the bundle points at, not from an empty or changed build.
    expect(assetFiles).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sheet-[\w-]+\.png$/),
        expect.stringMatching(/room-[\w-]+\.json$/),
      ]),
    )
    const code = chunks.map((chunk) => chunk.code).join('\n')
    expect(code).toMatch(/new URL\(["'`][^"'`]*sheet-[\w-]+\.png["'`]/)
    expect(code).toMatch(/new URL\(["'`][^"'`]*room-[\w-]+\.json["'`]/)
  }, 90_000)

  it('passes data: strings it cannot tie to an inlined asset, and new URL on a variable', () => {
    const clean = [
      // Pixi's own probes (pixi.js 8.21 detectVideoAlphaMode, detectWebp), as Vite 8 minifies them.
      't.src=`data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKE`',
      'const webp="data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="',
      // A bare data: constant (how Vite writes `import url from "./a.png"`): not told apart from the above.
      'var e=`data:image/png;base64,iVBORw0KGgo=`',
      // Pixi's own module resolution: a variable, not an asset.
      'new URL(e,import.meta.url)',
      // No import.meta.url base: not Vite's asset form.
      'new URL(`data:text/plain,hi`)',
    ].join(';\n')
    expect(scanForDataUrls('dist/assets/index.js', clean)).toEqual([])
  })

  it('reads the quoted, double-quoted and template forms, and a URL off globalThis', () => {
    const forms = [
      'new URL("data:audio/wav;base64,UklGRg==", import.meta.url)',
      "new URL('data:application/json;base64,e30=', `` + import.meta.url)",
      'new globalThis.URL(`data:image/png;base64,iVBO`, "" + import.meta.url)',
    ].join(';\n')
    expect(scanForDataUrls('dist/assets/index.js', forms).map((f) => [f.line, f.col])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ])
  })

  // Pixi's loadWebFont loads a font with `new FontFace(name, url(…))`, under font-src, which allows data:, so an
  // inlined font loads; only the loaders that fetch (textures, JSON, AF's audio) are refused.
  it('passes an inlined font, which loads under font-src, and says which loaders are refused', () => {
    const bundle = [
      'new URL(`data:font/woff2;base64,d09GMg==`, `` + import.meta.url)',
      'new URL(`data:font/ttf;base64,AAEAAA==`, `` + import.meta.url)',
      'new URL(`data:audio/mpeg;base64,SUQz`, `` + import.meta.url)',
    ].join(';\n')
    const findings = scanForDataUrls('dist/assets/index.js', bundle)
    expect(findings.map((f) => [f.line, /\((\S+)\)/.exec(f.message)?.[1]])).toEqual([[3, 'audio/mpeg']])
    expect(findings[0]?.message).toContain("Pixi's texture and JSON loaders and AF's audio fetch it")
  })

  it('reports a bundle it cannot parse instead of passing it', () => {
    expect(scanForDataUrls('dist/assets/broken.js', 'new URL(').map((f) => f.rule)).toEqual(['parse-error'])
  })
})

// The finding's message states what Ruken's CSP does with data: URLs. These are Ruken's facts, read from the headers
// Ruken compiles for a game (compileHeaders), so a change in Ruken fails here instead of leaving the message wrong.
describe("Ruken's CSP and data: URLs", () => {
  const config = defineShipConfig({
    game: { id: 'data-url-fixture', title: 'Data URL', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
    runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['keyboard'], pause_behavior: 'pause' },
    network: { connect: ['https://api.example.com'] },
    content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  })

  it('refuses data: for fetch and media, and allows it only for images and fonts', async () => {
    const csp = (await Effect.runPromise(headersFor(config)))['Content-Security-Policy'] ?? ''
    const sources = (directive: string) =>
      csp
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .find(([name]) => name === directive)
        ?.slice(1) ?? []
    expect(sources('default-src')).toEqual(["'none'"])
    expect(sources('connect-src')).not.toContain('data:')
    expect(sources('media-src')).not.toContain('data:')
    expect(sources('img-src')).toContain('data:')
    expect(sources('font-src')).toContain('data:')
  })
})
