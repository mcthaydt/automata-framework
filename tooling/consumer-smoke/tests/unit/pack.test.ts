import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type PackOptions, packPublished } from '#src/pack.ts'
import { publishablePackages } from '../../../release/src/publishable-packages.ts'

// Packing the published packages for a project outside the workspace. A temporary workspace and an injected `pack`
// keep every test off the build; the last one packs the real workspace when it is built.

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})
function temp(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix))
  folders.push(folder)
  return folder
}

function write(root: string, dir: string, manifest: object, withDist = true): void {
  mkdirSync(join(root, dir, withDist ? 'dist' : ''), { recursive: true })
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest))
}

/** Two published packages and a private one, which is never packed. */
function workspace(): string {
  const root = temp('af-packs-ws-')
  write(root, 'packages/testing', { name: '@automata/testing', version: '0.0.2' })
  write(root, 'packages/sim', { name: '@automata/sim', version: '0.0.2' })
  write(root, 'packages/editor', { name: '@automata/editor', version: '0.0.0', private: true })
  return root
}

/** What `pnpm pack` writes: `scope-name-version.tgz`. */
const fakePack = (dir: string, destination: string): string => {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string
    version: string
  }
  const file = `${manifest.name.slice(1).replace('/', '-')}-${manifest.version}.tgz`
  writeFileSync(join(destination, file), manifest.name)
  return file
}

const options = (root: string, out: string, extra: Partial<PackOptions> = {}): PackOptions => ({
  root,
  out,
  pack: fakePack,
  readPackedManifest: () => ({}),
  ...extra,
})

describe('packPublished', () => {
  it('packs every published package, sorted by name, and no private one', () => {
    const out = join(temp('af-packs-out-'), 'packs')
    expect(packPublished(options(workspace(), out))).toEqual([
      { name: '@automata/sim', file: 'automata-sim-0.0.2.tgz' },
      { name: '@automata/testing', file: 'automata-testing-0.0.2.tgz' },
    ])
    expect(existsSync(join(out, 'automata-editor-0.0.0.tgz'))).toBe(false)
  })

  it('fails on a published package without a dist, naming it', () => {
    const root = workspace()
    rmSync(join(root, 'packages/testing/dist'), { recursive: true })
    expect(() => packPublished(options(root, join(temp('af-packs-out-'), 'p')))).toThrow(
      'packages/testing/dist is missing: run pnpm build first',
    )
  })

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'fails on a pack that still has a workspace: range in %s, naming the package and the range',
    (field) => {
      const packed = { [field]: { '@automata/sim': 'workspace:*' } }
      expect(() =>
        packPublished(
          options(workspace(), join(temp('af-packs-out-'), 'p'), { readPackedManifest: () => packed }),
        ),
      ).toThrow('@automata/sim has a workspace: range after packing: @automata/sim workspace:*')
    },
  )

  it('replaces an earlier run, and refuses an out folder holding anything but packs', () => {
    const root = workspace()
    const out = temp('af-packs-out-')
    writeFileSync(join(out, 'old-0.0.1.tgz'), 'old')
    packPublished(options(root, out))
    expect(existsSync(join(out, 'old-0.0.1.tgz'))).toBe(false)
    writeFileSync(join(out, 'notes.txt'), 'mine')
    expect(() => packPublished(options(root, out))).toThrow('notes.txt')
    expect(readFileSync(join(out, 'notes.txt'), 'utf8')).toBe('mine')
  })
})

const realRoot = join(import.meta.dirname, '../../../..')
const published = publishablePackages(realRoot)
const built = published.every((pkg) => existsSync(join(realRoot, pkg.dir, 'dist')))
describe.skipIf(!built)('the real workspace with pnpm pack (needs pnpm build)', () => {
  it('packs every published package with no workspace: range left', () => {
    const out = join(temp('af-packs-out-'), 'packs')
    const packs = packPublished({ root: realRoot, out })
    expect(packs.map((pack) => pack.name)).toEqual(published.map((pkg) => pkg.manifest.name).sort())
    for (const pack of packs) expect(existsSync(join(out, pack.file)), pack.file).toBe(true)
  }, 120_000)
})
