import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadSeams, type Seam, seamFindings } from './seams.ts'

// PRODUCT.1b (the Plus part): the F1 seams of the framework's `tooling/api-report/src/seams.ts` are what a Plus package plugs
// into, so each must be a public `exports` entry of an installed core pack. The boundary test (core-imports.ts) checks the
// imports Plus makes; this one checks the seams Plus is promised, so a core change that drops one fails here, not at the
// first import.

describe('seamFindings', () => {
  let root = ''
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const pack = (name: string, exports: Record<string, unknown>): void => {
    const dir = name.replace('@mcthaydt/', '')
    write(`.core/packs/${dir}/package.json`, JSON.stringify({ name, version: '0.0.4', exports }))
  }
  const packs = (names: readonly string[]): void =>
    write(
      '.core/packs/packs.json',
      JSON.stringify({
        sourceCommit: 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b',
        packs: names.map((name) => ({
          name,
          version: '0.0.4',
          file: `${name.replace('@mcthaydt/', 'mcthaydt-')}-0.0.4.tgz`,
          sha256: 'a'.repeat(64),
          dir: name.replace('@mcthaydt/', ''),
        })),
      }),
    )
  const seam = (over: Partial<Seam>): Seam => ({
    seam: 'NetworkPort',
    package: '@mcthaydt/automata-runtime',
    entryPoint: '.',
    name: 'NetworkPort',
    ...over,
  })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plus-seams-'))
    packs(['@mcthaydt/automata-runtime'])
    pack('@mcthaydt/automata-runtime', { '.': './dist/index.js', './extension': './dist/extension.js' })
  })

  it('passes a seam whose package entry is public', () => {
    expect(
      seamFindings(root, [seam({}), seam({ entryPoint: './extension', name: 'defineExtension' })]),
    ).toEqual([])
  })

  it('fails a seam of a core package Plus cannot install', () => {
    const missing = seam({
      seam: 'render layer',
      package: '@mcthaydt/automata-render-pixi',
      name: 'PixiStage',
    })
    expect(seamFindings(root, [missing])).toEqual([
      'seam "render layer" (PixiStage): "@mcthaydt/automata-render-pixi" is not a public entry of an installed core pack',
    ])
  })

  it('fails a seam whose entry the package no longer exports', () => {
    expect(seamFindings(root, [seam({ entryPoint: './gone', name: 'x' })])).toEqual([
      'seam "NetworkPort" (x): "@mcthaydt/automata-runtime/gone" is not a public entry of an installed core pack',
    ])
  })

  it('says to run the sync when there are no packs', () => {
    const bare = mkdtempSync(join(tmpdir(), 'plus-seams-bare-'))
    expect(() => seamFindings(bare, [seam({})])).toThrow(/pnpm core:sync/)
  })
})

describe('the real workspace (P-c)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

  it('reads the framework seams at core.ref', async () => {
    const seams = await loadSeams(root)
    expect(seams.length).toBeGreaterThan(10)
    expect(seams.some((s) => s.seam === 'NetworkPort')).toBe(true)
  })

  it('has every seam reachable through the installed packs', async () => {
    expect(seamFindings(root, await loadSeams(root))).toEqual([])
  })
})
