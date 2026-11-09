// F-g: the fixture actions `reach`, `look` and `flinch` (compiled to clips), three actions as data, end within 1e-3 figure units of
// their recorded end poses (tests/fixtures/goldens/actions.json, written by scripts/record-goldens.ts) at the
// same state: Wick standing still at t 0, facing +z.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { at, JOINTS } from '#src/features/figures/body/rig.ts'
import { clipWarnings } from '#src/features/figures/clips/clip-warnings.ts'
import { evaluate } from '#src/features/figures/clips/evaluate.ts'
import { type FixtureMotion, fixtureMotion } from '#src/testing/fixture-motion.ts'

interface ActionGoldens {
  readonly ends: Readonly<Record<string, readonly (readonly number[])[]>>
}
const GOLDENS = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../fixtures/goldens/actions.json'), 'utf8'),
) as ActionGoldens

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

/** Each end pose: the clip, and how long before t 0 it started (the action's time at that pose). */
const ENDS = [
  { end: 'reach', clip: 'reach', since: 0.7 },
  { end: 'look-out', clip: 'look', since: 1 },
  { end: 'look', clip: 'look', since: 4 },
  { end: 'flinch', clip: 'flinch', since: 1 },
]

describe('F-g: the actions as clips', () => {
  it.each(ENDS)('$clip ends within 1e-3 figure units of its recorded $end pose', ({ end, clip, since }) => {
    const { body, wick, library } = fixture
    const k = body.genes.height / 1.62
    const golden = GOLDENS.ends[end]
    if (!golden) throw new Error(`no golden ${end}`)
    const { world } = evaluate(
      body,
      wick,
      { moving: false, speed: 0, facing: 0, action: { id: clip, startedAt: -since } },
      0,
      library,
    )
    let worst = 0
    JOINTS.forEach((_, joint) => {
      const m = at(world, joint)
      const g = golden[joint] ?? []
      worst = Math.max(
        worst,
        Math.hypot(m[9] / k - (g[0] ?? 0), m[10] / k - (g[1] ?? 0), m[11] / k - (g[2] ?? 0)),
      )
    })
    expect(worst).toBeLessThan(1e-3)
  })
  it('compiles the three actions to clips with no warnings', () => {
    const { library } = fixture
    for (const id of ['reach', 'look', 'flinch']) {
      const clip = library.clips[id]
      if (!clip) throw new Error(`no clip ${id}`)
      expect(clipWarnings(clip, library.poses)).toEqual([])
    }
  })
})
