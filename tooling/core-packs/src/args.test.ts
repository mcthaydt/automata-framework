import { describe, expect, it } from 'vitest'
import { parseArgs, resolveSourceCommit } from './args.ts'

const SHA = 'b'.repeat(40)

describe('parseArgs', () => {
  it('needs --out', () => {
    expect(() => parseArgs([])).toThrow('--out')
  })

  it('reads --out, repeated --extra, --source-commit and --allow-dirty', () => {
    expect(
      parseArgs([
        '--out',
        'packs',
        '--extra',
        '@mcthaydt/evidence',
        '--extra',
        '@mcthaydt/x',
        '--allow-dirty',
      ]),
    ).toEqual({
      out: 'packs',
      extras: ['@mcthaydt/evidence', '@mcthaydt/x'],
      allowDirty: true,
      unpack: false,
    })
    expect(parseArgs(['--out', 'p', '--source-commit', SHA])).toEqual({
      out: 'p',
      extras: [],
      allowDirty: false,
      unpack: false,
      sourceCommit: SHA,
    })
    expect(parseArgs(['--out', 'p', '--unpack'])).toMatchObject({ unpack: true })
  })

  it('rejects a flag with no value and an unknown flag', () => {
    expect(() => parseArgs(['--out'])).toThrow('--out needs a value')
    expect(() => parseArgs(['--out', 'p', '--extra'])).toThrow('--extra needs a value')
    expect(() => parseArgs(['--out', 'p', '--force'])).toThrow('unknown argument --force')
  })
})

describe('resolveSourceCommit', () => {
  const git = (dirty: boolean) => (args: readonly string[]) =>
    args[0] === 'rev-parse' ? `${SHA}\n` : dirty ? ' M packages/sim/src/index.ts\n' : ''

  it('is the commit of a clean tree', () => {
    expect(resolveSourceCommit({ out: 'p', extras: [], allowDirty: false, unpack: false }, git(false))).toBe(
      SHA,
    )
  })

  it('refuses a dirty tree: the packs would not be the commit they claim to be', () => {
    expect(() =>
      resolveSourceCommit({ out: 'p', extras: [], allowDirty: false, unpack: false }, git(true)),
    ).toThrow('uncommitted changes')
  })

  it('marks a dirty tree when allowed', () => {
    expect(resolveSourceCommit({ out: 'p', extras: [], allowDirty: true, unpack: false }, git(true))).toBe(
      `${SHA}+dirty`,
    )
  })

  it('takes an explicit commit as given and does not ask git', () => {
    const never = () => {
      throw new Error('git was asked')
    }
    expect(
      resolveSourceCommit(
        { out: 'p', extras: [], allowDirty: false, unpack: false, sourceCommit: SHA },
        never,
      ),
    ).toBe(SHA)
  })
})
