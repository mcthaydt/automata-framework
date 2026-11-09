import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesLive, ProcessRunner, ProcessRunnerLive } from '#src/node-seams.ts'
import { promoteEvidence } from '#src/promote-evidence.ts'

// DT-b, DT-c and DT-d. git is answered by a fake (the root is the temporary folder, or "not a checkout"); `cmp`,
// `mkdir` and `cp` are the real programs, so the copied bytes are checked on disk. Each repository starts with a
// clean `evidence.json` at its root, the provenance core's collector writes there; the DT-d cases replace it.

let root = ''
let outside = ''
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'dev-tools-promote-')))
  outside = realpathSync(mkdtempSync(join(tmpdir(), 'dev-tools-outside-')))
  write('evidence.json', evidenceJson(false))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

const write = (path: string, content: string | Uint8Array): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const bytes = (path: string): Buffer => readFileSync(join(root, path))
/** A PNG's first bytes: not valid UTF-8, so a text round trip would change them. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x80])

const live = Effect.runSync(ProcessRunner.pipe(Effect.provide(ProcessRunnerLive)))
const gitCalls: string[][] = []
const runner = (inCheckout: boolean) =>
  Layer.succeed(ProcessRunner, {
    run: (command, args, options) => {
      if (command !== 'git') return live.run(command, args, options)
      gitCalls.push([...args])
      return Effect.succeed(
        inCheckout
          ? { exitCode: 0, stdout: `${root}\n`, stderr: '' }
          : { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository\n' },
      )
    },
  })

const promote = (paths: string[], options: { inCheckout?: boolean; from?: string; to?: string } = {}) =>
  Effect.runPromise(
    promoteEvidence({
      cwd: root,
      from: options.from ?? 'evidence',
      to: options.to ?? 'docs/baselines',
      paths,
    }).pipe(Effect.provide(Layer.merge(FilesLive, runner(options.inCheckout ?? true)))),
  )

function evidenceJson(dirty: boolean, enginesAgree = true): string {
  return JSON.stringify({
    schemaVersion: 1,
    revision: { sha: 'b'.repeat(40), dirty },
    goldens: [{ scenario: 'sim/walk', enginesAgree }],
  })
}

describe('DT-b: lists what differs and copies nothing', () => {
  it('lists new and changed files, skipping dot files and files that are the same', async () => {
    write('evidence/responsive/a.png', PNG)
    write('evidence/responsive/b.png', PNG)
    write('evidence/responsive/c.png', PNG)
    write('evidence/.DS_Store', 'x')
    write('evidence/responsive/.hidden', 'x')
    write('docs/baselines/responsive/b.png', new Uint8Array([1, 2, 3]))
    write('docs/baselines/responsive/c.png', PNG)
    const out = await promote([])
    expect(out).toEqual({
      exit: 0,
      stdout: 'new      responsive/a.png\nchanged  responsive/b.png\n',
      stderr: '',
    })
    expect(gitCalls.at(-1)).toEqual(['-C', root, 'rev-parse', '--show-toplevel'])
    expect(existsSync(join(root, 'docs/baselines/responsive/a.png'))).toBe(false)
    expect([...bytes('docs/baselines/responsive/b.png')]).toEqual([1, 2, 3])
  })
})

describe('DT-c: promotes the named files and sets', () => {
  it('copies one file byte for byte', async () => {
    write('evidence/tutorial/phone-1.png', PNG)
    write('evidence/tutorial/phone-2.png', PNG)
    const out = await promote(['tutorial/phone-1.png'])
    expect(out).toEqual({ exit: 0, stdout: 'promoted tutorial/phone-1.png\n', stderr: '' })
    expect(bytes('docs/baselines/tutorial/phone-1.png').equals(Buffer.from(PNG))).toBe(true)
    expect(existsSync(join(root, 'docs/baselines/tutorial/phone-2.png'))).toBe(false)
  })

  it('copies a set folder with its subfolders, replacing a changed baseline', async () => {
    write('evidence/responsive/desktop/a.png', PNG)
    write('evidence/responsive/phone/b.png', PNG)
    write('evidence/responsive-old/c.png', PNG)
    write('docs/baselines/responsive/phone/b.png', 'old')
    const out = await promote(['responsive/'])
    expect(out).toEqual({ exit: 0, stdout: 'promoted responsive\n', stderr: '' })
    expect(bytes('docs/baselines/responsive/desktop/a.png').equals(Buffer.from(PNG))).toBe(true)
    expect(bytes('docs/baselines/responsive/phone/b.png').equals(Buffer.from(PNG))).toBe(true)
    expect(existsSync(join(root, 'docs/baselines/responsive-old'))).toBe(false)
  })

  it('refuses when there is no evidence folder', async () => {
    const out = await promote([])
    expect(out).toEqual({ exit: 2, stdout: '', stderr: 'no evidence/ here: run an evidence spec first\n' })
  })

  it('refuses outside a git checkout', async () => {
    const out = await promote([], { inCheckout: false })
    expect(out).toEqual({
      exit: 2,
      stdout: '',
      stderr: 'not in a git checkout: fatal: not a git repository\n',
    })
  })

  it('refuses a path not in the evidence folder, an absolute path and .., and copies nothing at all', async () => {
    write('evidence/ok.png', PNG)
    const out = await promote(['ok.png', 'missing.png', '/etc/passwd', '../secrets', 'a/../../b'])
    expect(out.exit).toBe(2)
    expect(out.stdout).toBe('')
    expect(out.stderr).toBe(
      [
        'not in evidence/: missing.png',
        'outside evidence/: /etc/passwd',
        'outside evidence/: ../secrets',
        'outside evidence/: a/../../b',
        'nothing promoted',
        '',
      ].join('\n'),
    )
    expect(existsSync(join(root, 'docs/baselines'))).toBe(false)
  })
})

describe('DT-d: an evidence file is checked before it is promoted', () => {
  it('promotes a clean evidence file', async () => {
    write('evidence/parity/evidence.json', evidenceJson(false))
    const out = await promote(['parity'])
    expect(out).toEqual({ exit: 0, stdout: 'promoted parity\n', stderr: '' })
    expect(bytes('docs/baselines/parity/evidence.json').toString()).toBe(evidenceJson(false))
  })

  it('refuses one made from a dirty tree, or not an evidence file, and copies nothing', async () => {
    write('evidence/parity/evidence.json', evidenceJson(true))
    write('evidence/parity/shot.png', PNG)
    write('evidence/other/evidence.json', '{"schemaVersion":1}')
    const out = await promote(['parity', 'other'])
    expect(out.exit).toBe(2)
    expect(out.stderr.split('\n')[0]).toBe(
      `refused  parity: evidence/parity/evidence.json: made from a dirty tree at ${'b'.repeat(7)}`,
    )
    expect(out.stderr.split('\n')[1]).toMatch(
      /^refused {2}other: evidence\/other\/evidence\.json: not an evidence file: /,
    )
    expect(existsSync(join(root, 'docs/baselines'))).toBe(false)
  })

  // The provenance is the run's evidence.json: the nearest one above the file inside the evidence folder, else the
  // one core's collector writes at the repository root. It is checked whatever was selected.
  it('refuses a single screenshot from a dirty run, copying nothing', async () => {
    write('evidence.json', evidenceJson(true))
    write('evidence/tutorial/x.png', PNG)
    const out = await promote(['tutorial/x.png'])
    expect(out).toEqual({
      exit: 2,
      stdout: '',
      stderr: `refused  tutorial/x.png: evidence.json: made from a dirty tree at ${'b'.repeat(7)}\nnothing promoted\n`,
    })
    expect(existsSync(join(root, 'docs/baselines'))).toBe(false)
  })

  it('refuses a screenshot from a run whose engines disagree', async () => {
    write('evidence.json', evidenceJson(false, false))
    write('evidence/tutorial/x.png', PNG)
    const out = await promote(['tutorial/x.png'])
    expect(out.stderr).toBe(
      'refused  tutorial/x.png: evidence.json: the engines disagree on sim/walk\nnothing promoted\n',
    )
    expect(existsSync(join(root, 'docs/baselines'))).toBe(false)
  })

  it('refuses a screenshot with no provenance at all', async () => {
    rmSync(join(root, 'evidence.json'))
    write('evidence/tutorial/x.png', PNG)
    const out = await promote(['tutorial/x.png'])
    expect(out.stderr).toBe(
      'refused  tutorial/x.png: no evidence.json above it in evidence/ or at the repository root; run the evidence collector\nnothing promoted\n',
    )
    expect(existsSync(join(root, 'docs/baselines'))).toBe(false)
  })

  it('uses the nearest evidence.json above the file before the root one', async () => {
    write('evidence/parity/evidence.json', evidenceJson(true))
    write('evidence/parity/shots/a.png', PNG)
    const out = await promote(['parity/shots/a.png'])
    expect(out.stderr.split('\n')[0]).toBe(
      `refused  parity/shots/a.png: evidence/parity/evidence.json: made from a dirty tree at ${'b'.repeat(7)}`,
    )
  })
})

describe('DT-c: --from, --to and every target stay inside', () => {
  it('refuses .. and absolute values for --to and --from', async () => {
    write('evidence/x.png', PNG)
    for (const [flag, value] of [
      ['to', `../${basename(outside)}`],
      ['to', outside],
      ['to', 'docs/../../x'],
      ['from', '../evidence'],
      ['from', '/tmp'],
    ] as const) {
      const out = await promote(['x.png'], { [flag]: value })
      expect(out, `${flag} ${value}`).toEqual({
        exit: 2,
        stdout: '',
        stderr: `--${flag} must be a folder inside the repository: ${value}\n`,
      })
    }
    expect(existsSync(join(outside, 'x.png'))).toBe(false)
  })

  it('refuses a --to that is a symlink to outside the repository', async () => {
    write('evidence/x.png', PNG)
    mkdirSync(join(root, 'docs'))
    symlinkSync(outside, join(root, 'docs/baselines'))
    const out = await promote(['x.png'])
    expect(out).toEqual({
      exit: 2,
      stdout: '',
      stderr: '--to resolves outside the repository: docs/baselines\n',
    })
    expect(existsSync(join(outside, 'x.png'))).toBe(false)
  })

  it('refuses a target whose folder under --to is a symlink to outside it', async () => {
    write('evidence/tutorial/x.png', PNG)
    mkdirSync(join(root, 'docs/baselines'), { recursive: true })
    symlinkSync(outside, join(root, 'docs/baselines/tutorial'))
    const out = await promote(['tutorial/x.png'])
    expect(out.exit).toBe(2)
    expect(out.stderr).toBe(
      'refused  tutorial/x.png: docs/baselines/tutorial/x.png resolves outside docs/baselines/\nnothing promoted\n',
    )
    expect(existsSync(join(outside, 'x.png'))).toBe(false)
  })

  it('refuses a target that is a symlink', async () => {
    write('evidence/x.png', PNG)
    write('outside-target.png', 'keep me')
    mkdirSync(join(root, 'docs/baselines'), { recursive: true })
    symlinkSync(join(root, 'outside-target.png'), join(root, 'docs/baselines/x.png'))
    const out = await promote(['x.png'])
    expect(out.stderr).toBe('refused  x.png: docs/baselines/x.png is a symlink\nnothing promoted\n')
    expect(bytes('outside-target.png').toString()).toBe('keep me')
  })
})
