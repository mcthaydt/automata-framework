import { describe, expect, it } from 'vitest'
import { type MergeOutcome, mergeFile } from '#src/shared/kit/sync/merge-drivers.ts'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const text = (data: string | Uint8Array): string =>
  typeof data === 'string' ? data : new TextDecoder().decode(data)

/** The merged text, or fails the test with what the merge asked instead. */
function merged(outcome: MergeOutcome): string {
  if (outcome.kind !== 'merged') throw new Error(`expected a merge, got ${JSON.stringify(outcome)}`)
  return text(outcome.data)
}

const three = (
  path: string,
  base: string | undefined,
  mine: string | undefined,
  theirs: string | undefined,
) =>
  mergeFile(path, {
    ...(base === undefined ? {} : { base: bytes(base) }),
    ...(mine === undefined ? {} : { mine: bytes(mine) }),
    ...(theirs === undefined ? {} : { theirs: bytes(theirs) }),
  })

describe('mergeFile: TOML and JSON by key', () => {
  it('keeps your flash and Claude’s shake in one file', () => {
    const base = 'flash = 0.2\nshake = 0.5\n'
    expect(
      merged(three('content/feel.toml', base, 'flash = 0.4\nshake = 0.5\n', 'flash = 0.2\nshake = 0.9\n')),
    ).toBe('flash = 0.4\nshake = 0.9\n')
  })

  it('keeps the comments of a file whose two changes are far apart', () => {
    const lines = (flash: number, shake: number) =>
      [
        '# How long the screen flashes, in seconds.',
        `flash = ${flash}`,
        '',
        '# Things that are not touched by either side.',
        'a = 1',
        'b = 2',
        'c = 3',
        '',
        '# How hard the screen shakes.',
        `shake = ${shake}`,
        '',
      ].join('\n')
    const result = merged(three('content/feel.toml', lines(0.2, 0.5), lines(0.4, 0.5), lines(0.2, 0.9)))
    expect(result).toBe(lines(0.4, 0.9))
  })

  it('asks, with no conflict marker anywhere, when both sides changed the same key', () => {
    const outcome = three('content/feel.toml', 'flash = 0.2\n', 'flash = 0.4\n', 'flash = 0.9\n')
    expect(outcome).toEqual({ kind: 'ask', reason: 'both-changed', where: 'flash' })
  })

  it('takes a change both sides made the same way', () => {
    expect(merged(three('content/feel.toml', 'a = 1\n', 'a = 2\n', 'a = 2\n'))).toBe('a = 2\n')
  })

  it('merges tables of a list by id, so two people edit two mobs', () => {
    const doc = (hpA: number, hpB: number, extra = '') =>
      `[[mob]]\nid = "a"\nhp = ${hpA}\n\n[[mob]]\nid = "b"\nhp = ${hpB}\n${extra}`
    const result = merged(
      three('content/mobs.toml', doc(1, 2), doc(5, 2), doc(1, 7, '\n[[mob]]\nid = "c"\nhp = 9\n')),
    )
    expect(result).toContain('hp = 5')
    expect(result).toContain('hp = 7')
    expect(result).toContain('id = "c"')
  })

  it('merges a list by on, the key a sequence step is named by', () => {
    const doc = (one: string, two: string) =>
      `[[step]]\non = "start"\ndo = "${one}"\n\n[[step]]\non = "end"\ndo = "${two}"\n`
    const result = merged(three('content/sequence.toml', doc('x', 'y'), doc('mine', 'y'), doc('x', 'theirs')))
    expect(result).toContain('"mine"')
    expect(result).toContain('"theirs"')
  })

  it('asks when one side changed a table the other removed', () => {
    const base = '[[mob]]\nid = "a"\nhp = 1\n\n[[mob]]\nid = "b"\nhp = 2\n'
    const mine = '[[mob]]\nid = "a"\nhp = 1\n\n[[mob]]\nid = "b"\nhp = 3\n'
    const theirs = '[[mob]]\nid = "a"\nhp = 1\n'
    expect(three('content/mobs.toml', base, mine, theirs).kind).toBe('ask')
  })

  it('merges JSON by key and keeps its indent and last newline', () => {
    const doc = (a: number, b: number) => `{\n    "a": ${a},\n    "b": ${b}\n}\n`
    expect(merged(three('level.af2d.json', doc(1, 1), doc(2, 1), doc(1, 3)))).toBe(doc(2, 3))
  })

  it('asks about a file that is not valid TOML on one side', () => {
    expect(three('content/feel.toml', 'a = 1\n', 'a = =\n', 'a = 1\nb = 2\n').kind).toBe('ask')
  })
})

describe('mergeFile: other text', () => {
  it('merges code changed in two places', () => {
    const doc = (a: string, b: string) => `${a}\n1\n2\n3\n4\n5\n${b}\n`
    expect(merged(three('src/x.ts', doc('a', 'b'), doc('A', 'b'), doc('a', 'B')))).toBe(doc('A', 'B'))
  })

  it('asks about code changed on the same lines', () => {
    expect(three('src/x.ts', 'x\n', 'y\n', 'z\n')).toEqual({ kind: 'ask', reason: 'both-changed' })
  })
})

describe('mergeFile: pictures and other bytes', () => {
  it('asks, and offers to keep both under another name', () => {
    const outcome = mergeFile('art/hero.png', {
      base: new Uint8Array([1]),
      mine: new Uint8Array([2]),
      theirs: new Uint8Array([3]),
    })
    expect(outcome).toEqual({ kind: 'ask', reason: 'both-changed', keepBothPath: 'art/hero-github.png' })
  })

  it('takes the side that changed it when only one did', () => {
    const outcome = mergeFile('art/hero.png', {
      base: new Uint8Array([1]),
      mine: new Uint8Array([1]),
      theirs: new Uint8Array([3]),
    })
    expect(outcome).toEqual({ kind: 'merged', data: new Uint8Array([3]) })
  })
})

describe('mergeFile: deletions and additions', () => {
  it('deletes when one side deleted and the other left it alone', () => {
    expect(three('a.toml', 'a = 1\n', 'a = 1\n', undefined)).toEqual({ kind: 'deleted' })
    expect(three('a.toml', 'a = 1\n', undefined, 'a = 1\n')).toEqual({ kind: 'deleted' })
  })

  it('asks when one side changed what the other deleted', () => {
    expect(three('a.toml', 'a = 1\n', 'a = 2\n', undefined)).toEqual({ kind: 'ask', reason: 'deleted-there' })
    expect(three('a.toml', 'a = 1\n', undefined, 'a = 2\n')).toEqual({ kind: 'ask', reason: 'deleted-here' })
  })

  it('keeps a file only one side added, and asks about two different new files of one name', () => {
    expect(merged(three('new.toml', undefined, 'a = 1\n', undefined))).toBe('a = 1\n')
    expect(three('new.toml', undefined, 'a = 1\n', 'a = 2\n').kind).toBe('ask')
    expect(merged(three('new.toml', undefined, 'a = 1\n', 'a = 1\n'))).toBe('a = 1\n')
  })
})
