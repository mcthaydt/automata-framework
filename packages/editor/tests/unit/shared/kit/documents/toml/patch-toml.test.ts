// @vitest-environment node
import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { loadDocumentFixture } from '#src/shared/kit/documents/testing/fixtures.ts'
import { patchToml } from '#src/shared/kit/documents/toml/patch-toml.ts'

// biome-ignore lint/suspicious/noExplicitAny: the values are untyped TOML data that each test edits by path
type Data = Record<string, any>

/** Patches `text` from the value it parses to into `edit(value)`, and returns the new text. */
function patched(text: string, edit: (value: Data) => void): string {
  const before = parse(text) as Data
  const after = structuredClone(before)
  edit(after)
  const result = patchToml(text, before, after)
  if (!result.ok) throw new Error(`refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

/** The one region two texts differ in, by their longest common prefix and suffix. */
function changedRegion(before: string, after: string): { at: number; removed: string; added: string } {
  let prefix = 0
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return {
    at: prefix,
    removed: before.slice(prefix, before.length - suffix),
    added: after.slice(prefix, after.length - suffix),
  }
}

const TUNING = loadDocumentFixture('platformer-tuning.toml')
const JUICE = loadDocumentFixture('platformer-juice.toml')

describe('patchToml', () => {
  for (const name of [
    'platformer-tuning.toml',
    'platformer-juice.toml',
    'af-game.toml',
    'af-flow.toml',
    'af-stage-dawn.toml',
    'af-character-cyan.toml',
  ] as const) {
    it(`${name}: an unchanged value prints byte for byte`, () => {
      const text = loadDocumentFixture(name)
      expect(patched(text, () => {})).toBe(text)
    })
  }

  it("tuning.toml: a new MAX_MOVE_SPEED changes only that literal's span, and stays a float", () => {
    const out = patched(TUNING, (value) => {
      value.MAX_MOVE_SPEED = 400
    })
    const start = TUNING.indexOf('356.0')
    expect(out).toBe(`${TUNING.slice(0, start)}400.0${TUNING.slice(start + '356.0'.length)}`)
  })

  it('juice.toml: a number inside an inline table changes only its span; the comments stay', () => {
    const out = patched(JUICE, (value) => {
      value.springs.squash.zeta = 0.5
    })
    const start = JUICE.indexOf('zeta = 0.35') + 'zeta = '.length
    expect(out).toBe(`${JUICE.slice(0, start)}0.5${JUICE.slice(start + '0.35'.length)}`)
  })

  it('a float literal given a whole number stays a float, and no number is written with an exponent', () => {
    // toml-patch alone writes `threshold = 1` (an integer) and keeps an exponent's style (`1e3` set to 2000 is `2e3`).
    const out = patched(JUICE, (value) => {
      value.slam.threshold = 1
    })
    expect(out).toBe(JUICE.replace('threshold = 0.6 ', 'threshold = 1.0 '))
    expect(
      patched('a = 1e3\n', (value) => {
        value.a = 2000
      }),
    ).toBe('a = 2000.0\n')
  })

  it('several scalars change in one patch, each in its own span', () => {
    const out = patched(JUICE, (value) => {
      value.limits.particles = 200
      value.lean.fullSpeed = 400
      value.slam.dust.ring = false
    })
    expect(out).toBe(
      JUICE.replace('particles = 160', 'particles = 200')
        .replace('fullSpeed = 356 ', 'fullSpeed = 400 ')
        .replace('ring = true', 'ring = false'),
    )
  })

  it('writes a new number exactly, and leaves a number the file already says exactly alone', () => {
    expect(
      patched(TUNING, (value) => {
        value.FLOOR_GAP_MIN = 540 / 4.2
      }),
    ).toBe(TUNING)
    const out = patched(TUNING, (value) => {
      value.GRAVITY = -275.123456
      value.MOVING_FLOOR_CARRY = 0.00001
      value.BOUNCE_VELOCITY = 268.20000001
    })
    expect(parse(out)).toMatchObject({
      GRAVITY: -275.123456,
      MOVING_FLOOR_CARRY: 0.00001,
      BOUNCE_VELOCITY: 268.20000001,
    })
    expect(out).toContain('GRAVITY = -275.123456\n')
    expect(out).toContain('BOUNCE_VELOCITY = 268.20000001\n')
  })

  it('a key added or removed goes through toml-patch, with every comment kept', () => {
    const added = patched(JUICE, (value) => {
      value.lean.minDeg = 2
    })
    expect(parse(added).lean.minDeg).toBe(2)
    expect(added.replace('minDeg = 2\n', '')).toBe(JUICE)
    const removed = patched(JUICE, (value) => {
      delete value.lean.stepDeg
    })
    expect(removed).toBe(JUICE.replace('stepDeg = 3\n', ''))
  })

  it('an array of tables gains an element laid out like its siblings', () => {
    const text = loadDocumentFixture('af-flow.toml')
    const out = patched(text, (value) => {
      value.transitions.push({ from: 'Lobby', event: 'quit', to: 'MainMenu' })
    })
    expect(parse(out).transitions.at(-1)).toEqual({ from: 'Lobby', event: 'quit', to: 'MainMenu' })
    expect(out.startsWith(text.trimEnd())).toBe(true)
    expect(out.slice(text.trimEnd().length)).toMatch(
      /^\n\n\[\[transitions\]\]\nfrom = "Lobby"\nevent = "quit"\nto = "MainMenu"\n$/,
    )
  })

  it('refuses a before value that is not what the text reads, naming where', () => {
    const before = parse(TUNING) as Data
    const after = { ...before, GRAVITY: -300 }
    expect(patchToml(TUNING, { ...before, GRAVITY: -200 }, after)).toMatchObject({
      ok: false,
      reason: 'before-mismatch',
      path: ['GRAVITY'],
    })
  })

  it('refuses a text that is not TOML', () => {
    expect(patchToml('a = = 1', {}, {})).toMatchObject({ ok: false, reason: 'invalid-text', path: [] })
  })

  it('refuses a value it cannot write, naming where', () => {
    const before = parse(TUNING) as Data
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(patchToml(TUNING, before, { ...before, GRAVITY: bad })).toMatchObject({
        ok: false,
        reason: 'unwritable-value',
        path: ['GRAVITY'],
      })
    }
    expect(patchToml(TUNING, before, { ...before, GRAVITY: [1, undefined] })).toMatchObject({
      ok: false,
      reason: 'unwritable-value',
      path: ['GRAVITY', 1],
    })
  })
})
