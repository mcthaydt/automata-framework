import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostic } from '@automataframework/automata-content'
import { beforeAll, describe, expect, it } from 'vitest'
import type { RigLimits } from '../library/rig-limits.schema'
import { apply, scale } from '../math/math'
import { J, JOINTS, restPose, type Skeleton } from '../rig/rig'
import { solve } from '../solve/solve'
import type { EffectorId, Vec3 } from '../solve/targets'
import { compileFixture, FIXTURE_ROOT } from '../testing/compile-fixture'
import { FIGUREBUILDER_HAND_ON_HIP } from '../testing/figurebuilder-hand-on-hip'
import { fixtureLimits } from '../testing/fixture-limits'
import { FIXTURE_POSE_IDS, fixturePoses, posesOf } from '../testing/fixture-poses'
import { at3, distance, KEEPER, unit, WICK } from '../testing/solve-fixtures'
import { applyPose } from './apply-pose'
import { blend } from './blend'
import { mirror } from './mirror'
import type { PoseDef } from './pose.schema'
import { canonicalPose, printPose } from './pose-spelling'

const FIGURES: readonly (readonly ['wick' | 'keeper', Skeleton])[] = [
  ['wick', WICK],
  ['keeper', KEEPER],
]
const fileOf = (id: string): string => `content/figure-poses/${id}.toml`
const fixtureText = (id: string): string => readFileSync(join(FIXTURE_ROOT, fileOf(id)), 'utf8')

let poses: Record<string, PoseDef>
let limits: RigLimits
beforeAll(async () => {
  poses = await fixturePoses()
  limits = await fixtureLimits()
})
const pose = (id: string): PoseDef => {
  const found = poses[id]
  if (!found) throw new Error(`no fixture pose ${id}`)
  return found
}

describe('the fixture pose library', () => {
  it('has the fixture poses (the seven of the spec, and those of M3.6d for F-g and I-k), each written canonically', () => {
    expect(Object.keys(poses).sort()).toEqual([...FIXTURE_POSE_IDS])
    for (const id of FIXTURE_POSE_IDS) expect(canonicalPose(pose(id))).toEqual(pose(id))
  })
  it('solves every pose on Wick and the keeper with every effector reached and no joint at a limit', () => {
    for (const id of FIXTURE_POSE_IDS) {
      const p = pose(id)
      for (const [name, skeleton] of FIGURES) {
        const input = applyPose(skeleton, restPose(), p)
        const { report } = solve(skeleton, input.base, input.targets, limits)
        // Every effector the pose names is reported, and so is any foot that re-solved because the hips moved.
        const reported = Object.keys(report.reached)
        expect(reported, `${id} on ${name}`).toEqual(expect.arrayContaining(Object.keys(p.effectors)))
        for (const effector of reported)
          expect(report.reached[effector as EffectorId]?.ok, `${id} ${effector} on ${name}`).toBe(true)
        expect(report.limited, `${id} on ${name}`).toEqual([])
      }
    }
  })
})

describe('I-f: mirror, canonical spelling and blend over the library', () => {
  it('mirror(mirror(p)) equals p for every fixture pose', () => {
    for (const id of FIXTURE_POSE_IDS) expect(mirror(mirror(pose(id)))).toEqual(pose(id))
  })
  it('a pose written to content and read back is equal', async () => {
    const files = Object.fromEntries(FIXTURE_POSE_IDS.map((id) => [fileOf(id), printPose(pose(id))]))
    const result = await compileFixture(files)
    if (!result.ok) throw new Error(result.message)
    expect(posesOf(result.content.data)).toEqual(poses)
  })
  it('blend(a, b, 0) equals a and blend(a, b, 1) equals b for every pair', () => {
    for (const a of FIXTURE_POSE_IDS)
      for (const b of FIXTURE_POSE_IDS) {
        expect(blend(pose(a), pose(b), 0)).toEqual(pose(a))
        expect(blend(pose(a), pose(b), 1)).toEqual(pose(b))
      }
  })
})

describe("hands-on-hips matches FigureBuilder's handOnHip", () => {
  /** Within this many figure units (1 cm on a 1.62 m figure) of where FigureBuilder places each figure's hands. */
  const TOLERANCE = 0.01
  it("starts from the same pelvis as FigureBuilder's skeleton", () => {
    for (const [name, skeleton] of FIGURES) {
      const pelvis = scale(skeleton.rest[J.pelvis] ?? [0, 0, 0], 1 / unit(skeleton))
      expect(distance(pelvis, [...FIGUREBUILDER_HAND_ON_HIP[name].pelvis])).toBeLessThan(1e-6)
    }
  })
  it(`puts both hands within ${TOLERANCE} figure units of FigureBuilder's places, on Wick and the keeper`, () => {
    for (const [name, skeleton] of FIGURES) {
      const k = unit(skeleton)
      const input = applyPose(skeleton, restPose(), pose('hands-on-hips'))
      const { world } = solve(skeleton, input.base, input.targets, limits)
      const root = world[J.root]
      if (!root) throw new Error('no root')
      for (const hand of ['handL', 'handR'] as const) {
        const placed: Vec3 = FIGUREBUILDER_HAND_ON_HIP[name][hand]
        const want = apply(root, scale([...placed], k))
        const joint = hand === 'handL' ? J['hand.L'] : J['hand.R']
        expect(distance(at3(world, joint), want) / k, `${hand} on ${name}`).toBeLessThan(TOLERANCE)
      }
    }
  })
})

describe('I-j: a bad pose fails content compile at its location', () => {
  /** The 1-based line of the first `needle` in `text`. */
  const lineOf = (text: string, needle: string): number =>
    text.slice(0, text.indexOf(needle)).split('\n').length
  async function failing(
    id: string,
    old: string,
    next: string,
  ): Promise<{ text: string; diagnostics: Diagnostic[] }> {
    const text = fixtureText(id)
    expect(text).toContain(old)
    const changed = text.replace(old, next)
    const result = await compileFixture({ [fileOf(id)]: changed })
    expect(result.ok).toBe(false)
    return { text: changed, diagnostics: result.ok ? [] : [...result.diagnostics] }
  }
  it('an unknown handle', async () => {
    const { text, diagnostics } = await failing('kneel', '[effectors.footL]', '[effectors.footC]')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'unknownField',
        file: fileOf('kneel'),
        line: lineOf(text, '[effectors.footC]'),
        column: 1,
        keyPath: 'effectors.footC',
      }),
    ])
  })
  it('an unknown joint', async () => {
    const { text, diagnostics } = await failing('guard-high', '"clavicle.L"', '"collar.L"')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'unknownField',
        file: fileOf('guard-high'),
        line: lineOf(text, '"collar.L"'),
        column: 1,
        keyPath: 'fk.collar.L',
      }),
    ])
  })
  it('a position past twice the reach, naming the value', async () => {
    const { text, diagnostics } = await failing('point', 'pos = [ -0.16, 1.3, 0.52 ]', 'pos = [ 0, 9, 0 ]')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        file: fileOf('point'),
        line: lineOf(text, 'pos = [ 0, 9, 0 ]'),
        column: 1,
        keyPath: 'effectors.handR.pos',
        message: expect.stringContaining('[0, 9, 0] is 9 figure units from the root'),
      }),
    ])
  })
  it('a number that is not finite', async () => {
    const { text, diagnostics } = await failing('point', 'rot = [ -90, 0, 0 ]', 'rot = [ nan, 0, 0 ]')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        file: fileOf('point'),
        line: lineOf(text, 'rot = [ nan, 0, 0 ]'),
        column: 1,
        code: 'invalidType',
        keyPath: ['effectors', 'handR', 'rot', '0'].join('.'),
        // The content compiler's own spelling of a non-finite number, naming the field and the value.
        message: 'effectors.handR.rot.0 must be a finite number, received nan',
      }),
    ])
  })
})

describe('a mirrored pose solves to the mirrored figure', () => {
  /** The joint on the other side (`hand.L` ↔ `hand.R`, `hemL` ↔ `hemR`), or itself. */
  const otherJoint = (name: string): string => {
    const last = name.at(-1)
    const swapped = `${name.slice(0, -1)}${last === 'L' ? 'R' : 'L'}`
    return (last === 'L' || last === 'R') && (JOINTS as readonly string[]).includes(swapped) ? swapped : name
  }
  /** S·W·S with S = diag(−1, 1, 1): a rigid frame seen in the mirror (rotation S·R·S, translation S·t). */
  const reflected = (m: readonly number[]): number[] =>
    m.map((v, i) => (i < 9 ? v * (i % 3 === 0 ? -1 : 1) * (i < 3 ? -1 : 1) : i === 9 ? -v : v))
  it('for every library pose on Wick and the keeper, within 1e-9', () => {
    for (const id of FIXTURE_POSE_IDS)
      for (const [name, skeleton] of FIGURES) {
        const solved = (p: PoseDef) => {
          const input = applyPose(skeleton, restPose(), p)
          return solve(skeleton, input.base, input.targets, limits).world
        }
        const world = solved(pose(id))
        const mirrored = solved(mirror(pose(id)))
        JOINTS.forEach((joint, j) => {
          const want = reflected(world[j] ?? [])
          const got = mirrored[JOINTS.indexOf(otherJoint(joint) as (typeof JOINTS)[number])] ?? []
          for (let i = 0; i < 12; i++)
            expect(
              Math.abs((got[i] ?? Number.NaN) - (want[i] ?? Number.NaN)),
              `${id} ${name} ${joint}`,
            ).toBeLessThan(1e-9)
        })
      }
  })
})
