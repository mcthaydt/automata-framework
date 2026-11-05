import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type PackManifest, packWorkspace } from '#src/pack.ts'
import { publishablePackages } from '../../../release/src/publishable-packages.ts'

// PRODUCT.5b: pack the workspace for a project outside it (the consumer smoke, and automata-plus while core has
// no registry, P5-D1). Everything here runs against a temporary workspace with an injected `pack`, so no test
// depends on a build; the last test packs the real `sim` when its dist exists.
const SOURCE = 'a'.repeat(40)
const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function temp(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix))
  folders.push(folder)
  return folder
}

function write(root: string, dir: string, manifest: object, withDist = false): void {
  mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest))
  if (withDist) {
    mkdirSync(join(root, dir, 'dist'))
    writeFileSync(join(root, dir, 'dist/index.js'), 'export {}\n')
  }
}

/** Two published packages, a private one, and a private tool with no dist (like `@mcthaydt/evidence`). */
function workspace(): string {
  const root = temp('af-core-packs-ws-')
  write(root, 'packages/sim', { name: '@mcthaydt/automata-sim', version: '0.0.2' }, true)
  write(root, 'packages/testing', { name: '@mcthaydt/automata-testing', version: '0.0.2' }, true)
  write(
    root,
    'packages/runtime',
    { name: '@mcthaydt/automata-runtime', version: '0.0.2', private: true },
    true,
  )
  write(root, 'tooling/evidence', { name: '@mcthaydt/evidence', version: '0.0.0', private: true })
  write(root, 'tooling/a-tool', { name: '@mcthaydt/a-tool', version: '0.0.0', private: true })
  return root
}

/** What `pnpm pack` writes: `scope-name-version.tgz`. The bytes depend only on the name and version. */
const fakePack = (dir: string, destination: string): string => {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string
    version: string
  }
  const file = `${manifest.name.slice(1).replace('/', '-')}-${manifest.version}.tgz`
  writeFileSync(join(destination, file), `${manifest.name}@${manifest.version}`)
  return file
}

/** What extracting a tarball leaves: `package.json` in the folder (the fake tarballs are text, not archives). */
const fakeUnpack = (tarball: string, dir: string): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ from: tarball }))
}

const clean = (): { name: string; version: string; dependencies?: Record<string, string> } => ({
  name: 'x',
  version: '0',
})

const options = (root: string, out: string, extra: Partial<Parameters<typeof packWorkspace>[0]> = {}) => ({
  root,
  out,
  extras: [] as readonly string[],
  sourceCommit: SOURCE,
  pack: fakePack,
  readPackedManifest: () => clean(),
  ...extra,
})

describe('packWorkspace', () => {
  it('packs every published package and each named extra, and nothing else', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'packs')
    const result = packWorkspace(options(root, out, { extras: ['@mcthaydt/evidence', '@mcthaydt/a-tool'] }))
    // Sorted by name, whatever order the workspace and the extras came in.
    expect(result.packs.map((pack) => [pack.name, pack.version, pack.file])).toEqual([
      ['@mcthaydt/a-tool', '0.0.0', 'mcthaydt-a-tool-0.0.0.tgz'],
      ['@mcthaydt/automata-sim', '0.0.2', 'mcthaydt-automata-sim-0.0.2.tgz'],
      ['@mcthaydt/automata-testing', '0.0.2', 'mcthaydt-automata-testing-0.0.2.tgz'],
      ['@mcthaydt/evidence', '0.0.0', 'mcthaydt-evidence-0.0.0.tgz'],
    ])
    expect(existsSync(join(out, 'mcthaydt-automata-runtime-0.0.2.tgz'))).toBe(false)
  })

  it('writes packs.json with the source commit and a SHA-256 for each file, the same bytes on a second run', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'packs')
    packWorkspace(options(root, out))
    const first = readFileSync(join(out, 'packs.json'), 'utf8')
    const written = JSON.parse(first) as PackManifest
    expect(written.sourceCommit).toBe(SOURCE)
    for (const pack of written.packs) {
      const bytes = readFileSync(join(out, pack.file))
      expect(pack.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
    packWorkspace(options(root, out))
    expect(readFileSync(join(out, 'packs.json'), 'utf8')).toBe(first)
  })

  it('fails on a published package without a dist, naming it', () => {
    const root = workspace()
    rmSync(join(root, 'packages/testing/dist'), { recursive: true })
    expect(() => packWorkspace(options(root, join(temp('af-core-packs-out-'), 'p')))).toThrow(
      'packages/testing/dist is missing: run pnpm build first',
    )
  })

  it('needs no dist for an extra, which exports source', () => {
    const root = workspace()
    expect(() =>
      packWorkspace(options(root, join(temp('af-core-packs-out-'), 'p'), { extras: ['@mcthaydt/evidence'] })),
    ).not.toThrow()
  })

  // FR.1: an extra that publishes built exports (the sector format) is packed with `dist`, so the build must have run first.
  it('needs dist for an extra that publishes built exports', () => {
    const root = workspace()
    write(root, 'packages/built-extra', {
      name: '@mcthaydt/a-built-extra',
      version: '0.0.0',
      private: true,
      publishConfig: { exports: { '.': './dist/index.js' } },
    })
    const run = () =>
      packWorkspace(
        options(root, join(temp('af-core-packs-out-'), 'p'), { extras: ['@mcthaydt/a-built-extra'] }),
      )
    expect(run).toThrow('packages/built-extra/dist is missing: run pnpm build first')
    mkdirSync(join(root, 'packages/built-extra/dist'))
    expect(run).not.toThrow()
  })

  it('fails on an extra that is not in the workspace, naming it', () => {
    const root = workspace()
    expect(() =>
      packWorkspace(options(root, join(temp('af-core-packs-out-'), 'p'), { extras: ['@mcthaydt/nope'] })),
    ).toThrow('extra @mcthaydt/nope is not a workspace package')
  })

  it('fails on a packed manifest that still has a workspace: range, naming the package and the range', () => {
    const root = workspace()
    expect(() =>
      packWorkspace(
        options(root, join(temp('af-core-packs-out-'), 'p'), {
          readPackedManifest: () => ({
            ...clean(),
            dependencies: { '@mcthaydt/automata-sim': 'workspace:*' },
          }),
        }),
      ),
    ).toThrow(
      '@mcthaydt/automata-sim has a workspace: range after packing: @mcthaydt/automata-sim workspace:*',
    )
  })

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'looks for a workspace: range in %s too',
    (field) => {
      const root = workspace()
      expect(() =>
        packWorkspace(
          options(root, join(temp('af-core-packs-out-'), 'p'), {
            readPackedManifest: () => ({ ...clean(), [field]: { '@mcthaydt/automata-sim': 'workspace:^' } }),
          }),
        ),
      ).toThrow('has a workspace: range after packing')
    },
  )

  it('unpacks each tarball into a folder named for the package when asked, and records the folder', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'packs')
    const result = packWorkspace(
      options(root, out, { extras: ['@mcthaydt/evidence'], unpack: true, unpackTarball: fakeUnpack }),
    )
    expect(result.packs.map((pack) => pack.dir)).toEqual(['automata-sim', 'automata-testing', 'evidence'])
    for (const pack of result.packs)
      expect(existsSync(join(out, pack.dir ?? 'none', 'package.json'))).toBe(true)
    expect((JSON.parse(readFileSync(join(out, 'packs.json'), 'utf8')) as PackManifest).packs[0]?.dir).toBe(
      'automata-sim',
    )
  })

  it('writes no folders and no dir field unless asked', () => {
    const out = join(temp('af-core-packs-out-'), 'packs')
    const result = packWorkspace(options(workspace(), out))
    expect(result.packs.every((pack) => !('dir' in pack))).toBe(true)
    expect(existsSync(join(out, 'automata-sim'))).toBe(false)
  })

  it('removes the folders of an earlier run, and only those, and refuses a folder it did not make', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'packs')
    const unpackOptions = { unpack: true, unpackTarball: fakeUnpack }
    packWorkspace(options(root, out, { extras: ['@mcthaydt/evidence'], ...unpackOptions }))
    packWorkspace(options(root, out, unpackOptions))
    expect(existsSync(join(out, 'evidence'))).toBe(false)
    expect(existsSync(join(out, 'automata-sim'))).toBe(true)
    mkdirSync(join(out, 'mine'))
    expect(() => packWorkspace(options(root, out, unpackOptions))).toThrow('mine')
    expect(existsSync(join(out, 'mine'))).toBe(true)
  })

  it('fails when two packages would share a folder name', () => {
    const root = workspace()
    write(root, 'tooling/other-sim', { name: '@other/automata-sim', version: '1.0.0', private: true })
    expect(() =>
      packWorkspace(
        options(root, join(temp('af-core-packs-out-'), 'p'), {
          extras: ['@other/automata-sim'],
          unpack: true,
          unpackTarball: fakeUnpack,
        }),
      ),
    ).toThrow('both unpack to automata-sim')
  })

  it('refuses an out folder that holds anything but packs, so it never deletes other files', () => {
    const root = workspace()
    const out = temp('af-core-packs-out-')
    writeFileSync(join(out, 'notes.txt'), 'mine')
    expect(() => packWorkspace(options(root, out))).toThrow('notes.txt')
    expect(readFileSync(join(out, 'notes.txt'), 'utf8')).toBe('mine')
  })

  it('replaces the packs of an earlier run in the out folder', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'packs')
    packWorkspace(options(root, out, { extras: ['@mcthaydt/evidence'] }))
    packWorkspace(options(root, out))
    expect(existsSync(join(out, 'mcthaydt-evidence-0.0.0.tgz'))).toBe(false)
  })

  it('rejects a source commit that is not 40 hex characters (optionally +dirty)', () => {
    const root = workspace()
    const out = join(temp('af-core-packs-out-'), 'p')
    expect(() => packWorkspace(options(root, out, { sourceCommit: 'main' }))).toThrow('source commit')
    expect(() => packWorkspace(options(root, out, { sourceCommit: `${SOURCE}+dirty` }))).not.toThrow()
  })
})

const realRoot = join(import.meta.dirname, '../../../..')
const published = publishablePackages(realRoot)
const built = published.every((pkg) => existsSync(join(realRoot, pkg.dir, 'dist')))
describe.skipIf(!built)('the real workspace with pnpm pack (needs pnpm build)', () => {
  it('packs every published package, with publishConfig applied and no workspace: range left', () => {
    const out = join(temp('af-core-packs-out-'), 'packs')
    const result = packWorkspace({
      root: realRoot,
      out,
      extras: ['@mcthaydt/evidence'],
      sourceCommit: SOURCE,
    })
    expect(result.packs.map((pack) => pack.name)).toEqual(
      [...published.map((pkg) => pkg.manifest.name), '@mcthaydt/evidence'].sort(),
    )
    for (const pack of result.packs) expect(existsSync(join(out, pack.file)), pack.file).toBe(true)
  }, 120_000)

  it('unpacks with tar into folders that hold the published layout', () => {
    const out = join(temp('af-core-packs-out-'), 'packs')
    const result = packWorkspace({ root: realRoot, out, extras: [], sourceCommit: SOURCE, unpack: true })
    const sim = result.packs.find((pack) => pack.name === '@mcthaydt/automata-sim')
    const manifest = JSON.parse(readFileSync(join(out, sim?.dir ?? 'none', 'package.json'), 'utf8')) as {
      name: string
      exports: Record<string, { import: string }>
    }
    expect(manifest.name).toBe('@mcthaydt/automata-sim')
    expect(existsSync(join(out, sim?.dir ?? 'none', manifest.exports['.']?.import ?? 'none'))).toBe(true)
  }, 120_000)
})
