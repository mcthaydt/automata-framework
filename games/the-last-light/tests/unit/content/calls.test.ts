import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'

// Every `{ call }` the game's files make has an answer in code: the creature's file names six (the night feature's four, the catch's, and the re-route on a clock the systems extension supplies), the puzzle two. A new call in a file with no
// answer would do nothing at play, so this test fails first (audit 7).

const ROOT = join(import.meta.dirname, '../../..')
const file = (path: string) => parse(readFileSync(join(ROOT, path), 'utf8'))

/** Every value of a `call` key anywhere in `value`. */
function callsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(callsOf)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'call' && typeof child === 'string' ? [child] : callsOf(child),
  )
}

describe('the calls the files make', () => {
  it('the creature calls only caught, wake, vigil, stop, leave and replan', () => {
    expect([...new Set(callsOf(file('content/systems/prologue.toml')))].sort()).toEqual([
      'caught',
      'leave',
      'replan',
      'stop',
      'vigil',
      'wake',
    ])
  })

  it('the puzzle calls only read and fill', () => {
    expect([...new Set(callsOf(file('content/puzzles/prologue.toml')))].sort()).toEqual(['fill', 'read'])
  })

  it('chase and fleeGoal are gone, and the fuel rule and the old fact light with them', () => {
    const text = readFileSync(join(ROOT, 'content/systems/prologue.toml'), 'utf8')
    expect(text).not.toMatch(/call = "(?:chase|fleeGoal|burnLight|footsteps)"|"fleeGoal"|"chase"/)
    expect(text).not.toMatch(/fact = "light"/)
  })
})
