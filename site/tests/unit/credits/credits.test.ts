// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CREDIT_GROUPS, CREDITS } from '#src/features/credits/credits-data.ts'

// /credits thanks the open-source work Automata is built on. The list is data, and this test holds it to the
// workspace's own manifests: a tool nobody uses any more fails here, and so does a new dependency nobody thanked.
const repository = resolve(import.meta.dirname, '../../../..')

type Manifest = {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const SKIPPED_FOLDERS = new Set([
  'node_modules',
  'fixtures',
  'dist',
  'build',
  '.svelte-kit',
  '.git',
  'paraglide',
  '.core',
])

/** Every workspace manifest: the repository's own package.json files, leaving out installed packages and test fixtures. */
function workspaceManifests(folder: string = repository): Manifest[] {
  const found: Manifest[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name))
      found.push(...workspaceManifests(join(folder, entry.name)))
    if (entry.isFile() && entry.name === 'package.json') {
      const manifest = JSON.parse(readFileSync(join(folder, entry.name), 'utf8')) as Manifest
      if (manifest.name) found.push(manifest)
    }
  }
  return found
}

const manifests = workspaceManifests()
const allNames = new Set(
  manifests.flatMap((m) => [
    ...Object.keys(m.dependencies ?? {}),
    ...Object.keys(m.peerDependencies ?? {}),
    ...Object.keys(m.optionalDependencies ?? {}),
    ...Object.keys(m.devDependencies ?? {}),
  ]),
)
const credited = new Set(CREDITS.flatMap((credit) => credit.packages))

/** Our own packages, and Ruken, which is a target we publish to and not a tool we thank here. */
const OURS = /^(@automata\/|@af-games\/|@af-examples\/|@ruken\/|@types\/)/

describe('the credits list', () => {
  it('reads the workspace', () => {
    expect(manifests.length).toBeGreaterThan(20)
  })

  it('names only packages the workspace really uses', () => {
    const unused = [...credited].filter((name) => !allNames.has(name))
    expect(unused).toEqual([])
  })

  it('thanks every outside package the framework, the editors and the site depend on to run', () => {
    const needed = new Set(
      manifests.flatMap((m) => [
        ...Object.keys(m.dependencies ?? {}),
        ...Object.keys(m.peerDependencies ?? {}),
        ...Object.keys(m.optionalDependencies ?? {}),
      ]),
    )
    const missing = [...needed].filter((name) => !OURS.test(name) && !credited.has(name)).sort()
    expect(missing).toEqual([])
  })

  it('credits the tools the Owner named, as they are really called', () => {
    expect(credited).toContain('pixi.js')
    expect(credited).toContain('@pixi/3d')
    expect(credited).toContain('@pmndrs/klipp')
    expect(credited).toContain('koota')
  })

  it('gives each entry a plain line, a licence and a link to its home', () => {
    for (const credit of CREDITS) {
      expect(credit.what.length, credit.name).toBeGreaterThan(10)
      expect(credit.what.length, `${credit.name} stays one short line`).toBeLessThanOrEqual(110)
      expect(credit.what, `${credit.name} ends like a sentence`).toMatch(/[.)]$/)
      expect(credit.licence, credit.name).toMatch(/\S/)
      expect(credit.url, credit.name).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]+(\/\S*)?$/)
    }
  })

  it('lists each name once and puts each entry in a group that exists', () => {
    const names = CREDITS.map((credit) => credit.name)
    expect(new Set(names).size).toBe(names.length)
    const groups = new Set(CREDIT_GROUPS.map((group) => group.id))
    expect(new Set(CREDITS.map((credit) => credit.group))).toEqual(groups)
  })

  it('credits each package once, so a thank-you is never doubled', () => {
    const all = CREDITS.flatMap((credit) => credit.packages)
    expect(all.filter((name, index) => all.indexOf(name) !== index)).toEqual([])
  })
})
