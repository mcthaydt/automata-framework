import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as code from './tuning.ts'

// GAME-2D.ED, the tuning half: `content/tuning.toml` is where the numbers are authored (each with its own range, which the
// content compiler checks and the Tuner shows as a slider). Until the sim reads compiled tuning (that moves the golden, see
// the plan), this test holds the file equal to `tuning.ts`, so the two cannot drift and the golden stays what it is.

type Entry = { value: number; min: number; max: number }

const parse = (text: string): Record<string, Entry> =>
  Object.fromEntries(
    text.split('\n').flatMap((line) => {
      const found = /^([A-Z_]+) = \{ value = (-?\d+), min = (-?\d+), max = (-?\d+), step = 1 \}$/.exec(line)
      return found
        ? [[found[1], { value: Number(found[2]), min: Number(found[3]), max: Number(found[4]) }]]
        : []
    }),
  )

const file = parse(readFileSync(new URL('../../content/tuning.toml', import.meta.url), 'utf8'))
const NOT_TUNABLE = ['SUB', 'TICK_HZ', 'HITBOX_W', 'HITBOX_H']

describe('content/tuning.toml', () => {
  it('holds every tunable of tuning.ts at its value, and no invariant', () => {
    const tunables = Object.entries(code).filter(([name]) => !NOT_TUNABLE.includes(name))
    expect(Object.keys(file).sort()).toEqual(tunables.map(([name]) => name).sort())
    for (const [name, value] of tunables) expect(file[name]?.value, name).toBe(value)
  })

  it('gives each tunable a range that contains its value', () => {
    for (const [name, entry] of Object.entries(file)) {
      expect(entry.min, name).toBeLessThanOrEqual(entry.value)
      expect(entry.value, name).toBeLessThanOrEqual(entry.max)
    }
  })
})
