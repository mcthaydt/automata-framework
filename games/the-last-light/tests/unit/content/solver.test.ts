import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLevel } from '@automata/3d/level'
import { hotspotsOf } from '@automata/interact/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import { createSolver } from '@automata/puzzle/solver'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { puzzleAgainstLevel } from '#src/testing/content-checks.ts'
import { modelOf } from '#src/testing/solver-model.ts'

const ROOT = join(import.meta.dirname, '../../..')
const puzzle = parse(
  readFileSync(join(ROOT, 'content/puzzles/prologue.toml'), 'utf8'),
) as unknown as PuzzleDef
const level = readLevel(
  JSON.parse(readFileSync(join(ROOT, 'content/levels/prologue.af-sector.json'), 'utf8')),
).level
const { hotspots, problems } = hotspotsOf(level)

describe('the prologue puzzle', () => {
  it('reads every hotspot of the level', () => {
    expect(problems).toEqual([])
    expect(hotspots).toHaveLength(19)
  })

  it('can be finished', () => {
    const result = createSolver(puzzle, modelOf(hotspots)).solve()
    expect(result.solvable).toBe(true)
    expect(result.capped).toBe(false)
  })

  it('cannot be finished if the supply room never opens (the shelf waits for the door)', () => {
    const shut = hotspots.map((spot) =>
      spot.id === 'closetDoor' ? { ...spot, when: [{ fact: 'noSuchFact', is: true }] } : spot,
    )
    expect(shut.find((spot) => spot.id === 'closetDoor')?.when).toBeDefined()
    // The door's own hotspot is what the puzzle uses first, so locking it behind a fact nothing sets blocks the scene.
    expect(createSolver(puzzle, modelOf(shut)).solve().solvable).toBe(false)
  })
})

describe('the puzzle against the level', () => {
  it('agrees: every hotspot the puzzle names is in the level, at the same place', () => {
    expect(puzzleAgainstLevel(puzzle, hotspots)).toEqual([])
  })

  it('says so in a sentence naming both when a hotspot is taken out of the level (review focus 5)', () => {
    const [problem] = puzzleAgainstLevel(
      puzzle,
      hotspots.filter((spot) => spot.id !== 'nightstand'),
    )
    expect(problem).toMatch(/puzzle.*"nightstand".*level/)
  })

  it('says so when the two disagree about where it stands', () => {
    const moved = hotspots.map((spot) => (spot.id === 'bed' ? { ...spot, x: spot.x + 1 } : spot))
    expect(puzzleAgainstLevel(puzzle, moved)[0]).toMatch(/"bed".*must agree/)
  })
})
