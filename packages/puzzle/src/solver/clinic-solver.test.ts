// The solver on the clinic (M6 spec §4.5, P-c): the adventure source's three clinic cases on the converted clinic
// and its ported solver model. Slow (the whole state graph), a few seconds.
import { describe, expect, it } from 'vitest'
import { CLINIC_MODEL } from '../testing/clinic-model'
import { scenePuzzle } from '../testing/converted-puzzles'
import { budget, createSolver } from './index'

const clinic = scenePuzzle('clinic')
const solver = createSolver(clinic, CLINIC_MODEL)
const result = solver.solve()
const ids = (steps: readonly { action: string }[] | undefined) => steps?.map((s) => s.action)

describe('puzzle solver: the clinic', () => {
  it('is solvable, with every key to the code and the water', () => {
    expect(result.solvable).toBe(true)
    expect(result.capped).toBe(false)
    expect(ids(result.shortest?.steps)).toEqual([
      'monitor.read',
      'code.right',
      'closetDoor.unlock',
      'shelf.take',
      'valve.shut',
      'fuseBox.seat',
      'exit.leave',
    ])
    const replaced = (first: string) =>
      result.alternatives
        .filter((a) => a.banned.startsWith(first) && a.solution !== null)
        .map((a) => (a.solution?.steps ?? []).map((s) => s.action))
    // Four sources of 04:17: the monitor, the record, the clock, the scratches behind the curtain.
    expect(replaced('monitor.read').map((s) => s[s.indexOf('code.right') - 1])).toEqual([
      'record.read',
      'clock.read',
      'scratches.read',
    ])
    // Two ways to dry the fuse box: the valve, or the cloth cut from a curtain.
    expect(replaced('valve.shut')).toEqual([
      [
        'bed.search',
        'curtainWest.cut',
        'monitor.read',
        'code.right',
        'closetDoor.unlock',
        'shelf.take',
        'puddle.use',
        'fuseBox.seat',
        'exit.leave',
      ],
    ])
    expect(result.alternatives.find((a) => a.banned === 'valve.shut + puddle.use')?.solution).toBeNull()
  }, 120_000)

  it('has no softlocks, and hints every lethal rule before its risk', () => {
    const { count, capped } = solver.softlocks()
    expect(capped).toBe(false)
    expect(count).toBe(0)
    const solutions = [result.shortest, ...result.alternatives.map((a) => a.solution)].filter(
      (s) => s !== null,
    )
    expect(solver.hints(solutions).filter((h) => !h.ok)).toEqual([])
  }, 120_000)

  it('fits the design budget', () => {
    // Straight lines between the hotspots: the scene's own walk (nav, every door open) is the game adapter's.
    const at = (id: string) => clinic.hotspots[id === 'code' ? 'cabinet' : id] ?? { x: 0, z: 0 }
    const walk = (from: string | null, to: string) => {
      const p = from === null ? { x: 0, z: 0 } : at(from)
      const q = at(to)
      return Math.hypot(q.x - p.x, q.z - p.z)
    }
    if (result.shortest === null) throw new Error('unsolved')
    const b = budget(result.shortest, walk)
    // The design's 12:10 is a first-time player's; the shortest route is far inside it.
    expect(b.total).toBeGreaterThan(20)
    expect(b.total).toBeLessThan(12 * 60 + 10)
  })
})
