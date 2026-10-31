import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { manifestProblems, PLUS_LICENSE, workspaceManifestProblems } from './manifest-rules.ts'

// Test 5 (PRODUCT.5e): every Plus package carries the Plus license (P5-D5) and lists core only under
// peerDependencies, so a buyer's game supplies the one copy of core (devDependencies resolve through the overrides
// for Plus's own tests). Plus has no package yet, so the check over the real workspace passes vacuously until 5f
// brings physics; the cases below pin the rules themselves.

const root = fileURLToPath(new URL('../..', import.meta.url))
const PLUS = new Set(['@mcthaydt/automata-physics', '@mcthaydt/automata-net'])
const PATH = 'packages/net/package.json'

const manifest = (fields: Record<string, unknown> = {}) => ({
  name: '@mcthaydt/automata-net',
  license: PLUS_LICENSE,
  peerDependencies: { '@mcthaydt/automata-sim': '0.1.0' },
  devDependencies: { '@mcthaydt/automata-sim': '0.1.0', '@mcthaydt/automata-testing': '0.1.0' },
  ...fields,
})

describe('the Plus workspace', () => {
  it('has no manifest problem', () => {
    expect(workspaceManifestProblems(root)).toEqual([])
  })
})

describe('manifestProblems', () => {
  it('accepts core under peerDependencies and devDependencies', () => {
    expect(manifestProblems(PATH, manifest(), PLUS)).toEqual([])
  })

  it('accepts other Plus packages and third-party packages as dependencies', () => {
    const dependencies = {
      '@mcthaydt/automata-physics': '0.1.0',
      '@dimforge/rapier2d-deterministic-compat': '0.19.3',
    }
    expect(manifestProblems(PATH, manifest({ dependencies }), PLUS)).toEqual([])
  })

  it.each([
    ['missing', undefined],
    ['MIT', 'MIT'],
    ['UNLICENSED', 'UNLICENSED'],
    ['a near miss', 'SEE LICENSE IN LICENSE.md'],
  ])('rejects a license that is %s', (_case, license) => {
    expect(manifestProblems(PATH, manifest({ license }), PLUS)).toEqual([
      `${PATH}: "license" must be "${PLUS_LICENSE}" (P5-D5); found ${JSON.stringify(license)}`,
    ])
  })

  it.each(['dependencies', 'optionalDependencies'])('rejects core under %s', (field) => {
    const problems = manifestProblems(
      PATH,
      manifest({ [field]: { '@mcthaydt/automata-sim': '0.1.0' } }),
      PLUS,
    )
    expect(problems).toEqual([
      `${PATH}: @mcthaydt/automata-sim is core; list it under peerDependencies (and devDependencies for tests), not ${field}`,
    ])
  })

  it('counts every @mcthaydt name that is not a Plus package as core, including the private evidence pack', () => {
    const dependencies = { '@mcthaydt/evidence': '0.0.0', '@mcthaydt/automata-ui': '0.1.0' }
    expect(manifestProblems(PATH, manifest({ dependencies }), PLUS)).toHaveLength(2)
  })

  it('reports every problem of one manifest', () => {
    const problems = manifestProblems(
      PATH,
      manifest({ license: 'MIT', dependencies: { '@mcthaydt/automata-sim': '0.1.0' } }),
      PLUS,
    )
    expect(problems).toHaveLength(2)
  })

  it('rejects a dependency map that is not an object', () => {
    expect(manifestProblems(PATH, manifest({ dependencies: ['@mcthaydt/automata-sim'] }), PLUS)).toEqual([
      `${PATH}: "dependencies" must be an object of names and ranges`,
    ])
  })
})

describe('workspaceManifestProblems', () => {
  let temp: string
  beforeEach(() => {
    temp = mkdtempSync(join(tmpdir(), 'plus-manifests-'))
  })
  afterEach(() => rmSync(temp, { recursive: true, force: true }))

  const write = (folder: string, fields: Record<string, unknown>) => {
    mkdirSync(join(temp, 'packages', folder), { recursive: true })
    writeFileSync(join(temp, 'packages', folder, 'package.json'), JSON.stringify(fields))
  }

  it('passes a workspace with no packages folder', () => {
    expect(workspaceManifestProblems(temp)).toEqual([])
  })

  it('checks every package and names the file of each problem', () => {
    write('net', manifest())
    write('physics', manifest({ name: '@mcthaydt/automata-physics', license: 'MIT' }))
    expect(workspaceManifestProblems(temp)).toEqual([
      `packages/physics/package.json: "license" must be "${PLUS_LICENSE}" (P5-D5); found "MIT"`,
    ])
  })

  // A package folder that was deleted from git can stay on disk with only its ignored node_modules.
  it('skips a folder that has no package.json', () => {
    mkdirSync(join(temp, 'packages', 'gone', 'node_modules'), { recursive: true })
    write('net', manifest())
    expect(workspaceManifestProblems(temp)).toEqual([])
  })

  // PRODUCT.6: a kit (kits/*) is copied into a game, so its manifest is held to the same rules.
  it('checks every kit and names the file of each problem', () => {
    mkdirSync(join(temp, 'kits', 'screens'), { recursive: true })
    writeFileSync(
      join(temp, 'kits', 'screens', 'package.json'),
      JSON.stringify(
        manifest({
          name: '@mcthaydt/automata-kit-screens',
          dependencies: { '@mcthaydt/automata-ui': '0.0.4' },
        }),
      ),
    )
    expect(workspaceManifestProblems(temp)).toEqual([
      'kits/screens/package.json: @mcthaydt/automata-ui is core; list it under peerDependencies (and devDependencies for tests), not dependencies',
    ])
  })

  it('treats a sibling Plus package as Plus, not core', () => {
    write('physics', manifest({ name: '@mcthaydt/automata-physics' }))
    write('net', manifest({ dependencies: { '@mcthaydt/automata-physics': '0.1.0' } }))
    expect(workspaceManifestProblems(temp)).toEqual([])
  })
})
