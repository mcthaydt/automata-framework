// @vitest-environment node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bootErrors, installApiIndex } from '../scripts/sync-api-index'

const COMMIT = 'a'.repeat(40)
const dirs: string[] = []
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-api-index-'))
  dirs.push(dir)
  return dir
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

const row = (pkg: string, name: string, kind: string, signature: string, doc: string) => ({ package: pkg, entryPoint: '.', name, kind, signature, doc, version: '0.0.3' })
const BOOT_ROWS = [
  row('@mcthaydt/automata-runtime', 'BootError', 'type', 'type BootError = HostError | LoadStalled | BootDefect;', 'Every way boot can fail.'),
  row('@mcthaydt/automata', 'LoadStalled', 'class', 'class LoadStalled extends LoadStalledBase {}', 'Re-exported by the umbrella.'),
  row('@mcthaydt/automata-runtime', 'LoadStalled', 'class', 'class LoadStalled extends LoadStalledBase {}', 'A download made no progress.'),
  row('@mcthaydt/automata-host', 'HostError', 'class', 'class HostError extends HostErrorBase {}', 'Any failure after the handshake.'),
  row('@mcthaydt/automata-runtime', 'BootDefect', 'class', 'class BootDefect extends BootDefectBase {}', 'An unexpected defect during boot.'),
]

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/** A folder shaped like the framework's `tooling/api-index/dist`. */
function dist(leaveOut?: string): string {
  const dir = temp()
  const files: Record<string, string> = {
    'api.json': `${JSON.stringify({ version: '0.0.3', exports: [{ name: 'createSim', version: '0.0.3' }, { name: 'runGame', version: '0.0.3' }, ...BOOT_ROWS] }, null, 2)}\n`,
    'llms-api.txt': '# API reference\n\n## createSim\n',
    'llms-full.txt': '# Automata Framework 0.0.3: full documentation\n\n---\n\n# API reference\n\n## createSim\n',
  }
  for (const [name, text] of Object.entries(files)) if (name !== leaveOut) writeFileSync(join(dir, name), text)
  return dir
}

/** A website folder with its `static` and `src/data` folders. */
function website(): string {
  const dir = temp()
  mkdirSync(join(dir, 'static'), { recursive: true })
  mkdirSync(join(dir, 'src/data'), { recursive: true })
  return dir
}

describe('installApiIndex', () => {
  it('publishes llms-full.txt and llms-api.txt byte for byte and records where they came from', () => {
    const from = dist()
    const to = website()
    installApiIndex(from, to, COMMIT, COMMIT)
    for (const name of ['llms-full.txt', 'llms-api.txt']) {
      expect(readFileSync(join(to, 'static', name), 'utf8')).toBe(readFileSync(join(from, name), 'utf8'))
    }
    expect(JSON.parse(readFileSync(join(to, 'src/data/api-index.json'), 'utf8'))).toEqual({
      commit: COMMIT,
      version: '0.0.3',
      exports: 2 + BOOT_ROWS.length,
      files: {
        'llms-full.txt': sha256(readFileSync(join(from, 'llms-full.txt'), 'utf8')),
        'llms-api.txt': sha256(readFileSync(join(from, 'llms-api.txt'), 'utf8')),
      },
    })
  })

  it('refuses a checkout that is not at framework.ref and writes nothing', () => {
    const to = website()
    expect(() => installApiIndex(dist(), to, 'b'.repeat(40), COMMIT)).toThrow(/framework\.ref/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
    expect(existsSync(join(to, 'src/data/api-index.json'))).toBe(false)
  })

  it('names a missing file and writes nothing', () => {
    const to = website()
    expect(() => installApiIndex(dist('llms-api.txt'), to, COMMIT, COMMIT)).toThrow(/llms-api\.txt/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
  })

  it('refuses a full text that does not end with the API reference it is published beside', () => {
    const from = dist()
    writeFileSync(join(from, 'llms-api.txt'), '# API reference\n\n## somethingElse\n')
    const to = website()
    expect(() => installApiIndex(from, to, COMMIT, COMMIT)).toThrow(/API reference/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
  })
})

describe('bootErrors', () => {
  it('lists the BootError union’s members in its order, each with the doc comment of its own package', () => {
    expect(bootErrors({ exports: BOOT_ROWS })).toEqual({
      signature: 'type BootError = HostError | LoadStalled | BootDefect;',
      doc: 'Every way boot can fail.',
      members: [
        { name: 'HostError', package: '@mcthaydt/automata-host', doc: 'Any failure after the handshake.' },
        { name: 'LoadStalled', package: '@mcthaydt/automata-runtime', doc: 'A download made no progress.' },
        { name: 'BootDefect', package: '@mcthaydt/automata-runtime', doc: 'An unexpected defect during boot.' },
      ],
    })
  })

  it('refuses an index without BootError, or with a member it does not document', () => {
    expect(() => bootErrors({ exports: BOOT_ROWS.filter(r => r.name !== 'BootError') })).toThrow(/BootError/)
    expect(() => bootErrors({ exports: BOOT_ROWS.filter(r => r.name !== 'HostError') })).toThrow(/HostError/)
  })

  it('is written beside the published files, with the commit', () => {
    const to = website()
    installApiIndex(dist(), to, COMMIT, COMMIT)
    const written = JSON.parse(readFileSync(join(to, 'src/data/boot-errors.json'), 'utf8'))
    expect(written.commit).toBe(COMMIT)
    expect(written.members.map((m: { name: string }) => m.name)).toEqual(['HostError', 'LoadStalled', 'BootDefect'])
  })
})
