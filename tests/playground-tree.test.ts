// @vitest-environment node
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileExample } from '../src/lib/playground/compile'
import { SITE_ORIGIN } from '../src/lib/site.js'
import { verifyPlaygroundTree } from '../scripts/sync-playground'

// The published playground (spec §5.5): the framework's build:playground tree at framework.ref, copied verbatim, plus
// the originals precompiled by the site's own compileExample.
const ref = readFileSync(resolve('framework.ref'), 'utf8').trim()
const tree = resolve('static/playground')

interface Example { id: string; source: string; moduleUrl: string }

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter(name => statSync(join(folder, name)).isFile())
    .map(name => relative(folder, join(folder, name)).split(sep).join('/'))
    .sort()
}

describe('the published playground tree', () => {
  it('is the build for framework.ref and the site origin, every file listed with its sha256', () => {
    const manifest = JSON.parse(readFileSync(join(tree, 'manifest.json'), 'utf8'))
    expect(manifest.framework).toBe(ref)
    expect(manifest.siteOrigin).toBe(SITE_ORIGIN)
    expect(verifyPlaygroundTree(tree, ref)).toEqual([])
  })

  it('src/data/examples.json is the tree’s catalog.json', () => {
    const catalog = JSON.parse(readFileSync(join(tree, 'catalog.json'), 'utf8'))
    expect(JSON.parse(readFileSync(resolve('src/data/examples.json'), 'utf8'))).toEqual(catalog)
  })

  it('has one precompiled original per example, each a fresh compileExample of its source', () => {
    const catalog = JSON.parse(readFileSync(join(tree, 'catalog.json'), 'utf8')) as Example[]
    expect(catalog.length).toBeGreaterThan(0)
    expect(filesUnder(join(tree, 'compiled'))).toEqual(catalog.map(example => `${example.id}.js`).sort())
    for (const example of catalog) {
      const result = compileExample(example.source, { id: example.id, moduleUrl: example.moduleUrl })
      expect(result, example.id).toMatchObject({ ok: true })
      if (result.ok) expect(readFileSync(join(tree, 'compiled', `${example.id}.js`), 'utf8'), example.id).toBe(result.code)
    }
  })
})

describe('verifyPlaygroundTree', () => {
  const commit = 'a'.repeat(40)
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'playground-tree-'))
    writeFileSync(join(dir, 'catalog.json'), '[]\n')
    writeFileSync(join(dir, 'frame.js'), 'export {}\n')
    const files = ['catalog.json', 'frame.js'].map(path => {
      const bytes = readFileSync(join(dir, path))
      return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    })
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ framework: commit, siteOrigin: SITE_ORIGIN, files, packages: [] }))
    return dir
  }

  it('passes a tree that matches its manifest', () => {
    const dir = fixture()
    expect(verifyPlaygroundTree(dir, commit)).toEqual([])
    rmSync(dir, { recursive: true })
  })

  it('refuses another commit, a changed byte, an unlisted file and a missing file', () => {
    const dir = fixture()
    expect(verifyPlaygroundTree(dir, 'b'.repeat(40))).toEqual([`manifest.json names framework ${commit}, not ${'b'.repeat(40)}`])
    writeFileSync(join(dir, 'frame.js'), 'export {};\n')
    writeFileSync(join(dir, 'extra.js'), '')
    rmSync(join(dir, 'catalog.json'))
    expect(verifyPlaygroundTree(dir, commit)).toEqual([
      'catalog.json is listed but missing',
      'frame.js does not match its sha256',
      'extra.js is not listed in manifest.json',
    ])
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true)
    rmSync(dir, { recursive: true })
  })
})
