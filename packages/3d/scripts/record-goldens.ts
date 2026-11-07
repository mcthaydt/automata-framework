// Records AF's goldens from AF's own code: the figure builder's geometry on every golden outfit, its motion
// (locomotion, stands, holds, the hair spring) and the end poses of the reach, look and flinch clips. The tests
// compare the code against these files; this script is the one place that writes them. A change that moves a
// golden is re-recorded in a named commit that explains it (the test, `goldens-fresh.test.ts`, fails until then).
//
//   pnpm --filter @automata/3d goldens [--out <dir>]     (default: tests/fixtures/goldens)
//
// Node loads it with `--import ./scripts/extensionless-ts.ts`, which the package script passes (a workspace package it
// imports writes relative imports without `.ts`).
//
// Numbers are kept to 13 significant digits (geometry) and 12 (motion); the readers allow 1e-9, so a last-bit
// difference between platforms' `Math` functions moves nothing.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, J } from '../src/features/figures/body/rig.ts'
import { evaluate } from '../src/features/figures/clips/evaluate.ts'
import { skeleton } from '../src/features/figures/figure/figure-skeleton.ts'
import { base } from '../src/features/figures/motion/base.ts'
import { DEFAULT_HAIR } from '../src/features/figures/motion/gait-of.ts'
import { HAIR_AT_REST, hairStep, headNod } from '../src/features/figures/motion/hair-spring.ts'
import { evaluateMotion, holdOf } from '../src/features/figures/motion/hold.ts'
import type { MotionState } from '../src/features/figures/motion/motion-state.ts'
import type { M } from '../src/shared/math/math.ts'
import { type FixtureFigures, fixtureFigures } from '../src/testing/fixture-library.ts'
import { fixtureMotion } from '../src/testing/fixture-motion.ts'
import { GOLDEN_OUTFITS } from '../src/testing/golden-outfits.ts'
import { recordDress, recordStands, round, section } from '../src/testing/golden-recorders.ts'
import { motionFingerprint } from '../src/testing/motion-fingerprint.ts'
import { AT_REST, GOLDEN_SOME_STATES, GOLDEN_STATES } from '../src/testing/motion-states.ts'

/** Where the committed goldens live. */
export const GOLDENS: string = join(import.meta.dirname, '../tests/fixtures/goldens')
/** The files written, by name. */
export const GOLDEN_FILES: readonly string[] = ['dress.json', 'motion.json', 'actions.json']

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`the fixture has no ${what}`)
  return value
}

/** Locomotion and stands on Wick's and the keeper's bodies, every item's hold, the stands on every golden
 * outfit, and the hair spring over forty steps. */
function recordMotion(fixture: FixtureFigures): string {
  const print = (world: readonly M[]) => round(motionFingerprint(world), 12)
  const bodies: Record<string, Record<string, unknown>> = {}
  const holds: Record<string, unknown> = {}
  const named = { wick: at(GOLDEN_OUTFITS, 0), keeper: at(GOLDEN_OUTFITS, 1) }
  // A body's own gait plays every state; the others play three.
  const own: Record<string, string> = { wick: 'bounce', keeper: 'elderly' }
  const strut = need(fixture.gaits.strut, 'strut gait')
  for (const [id, outfit] of Object.entries(named)) {
    const s = skeleton({ sliders: outfit.sliders })
    const body: Record<string, unknown> = {}
    for (const [gaitId, gait] of Object.entries(fixture.gaits))
      for (const label of gaitId === own[id] ? Object.keys(GOLDEN_STATES) : GOLDEN_SOME_STATES)
        body[`${gaitId} ${label}`] = print(base(s, gait, need(GOLDEN_STATES[label], label)).world)
    const bounce = need(fixture.gaits.bounce, 'bounce gait')
    for (const [standId, stand] of Object.entries(fixture.stands))
      body[`stand ${standId}`] = print(evaluateMotion(s, bounce, { ...AT_REST, t: 0.4, stand }).world)
    bodies[id] = body
    for (const [itemId, item] of Object.entries(fixture.library.items))
      for (const side of ['L', 'R'] as const)
        for (const label of GOLDEN_SOME_STATES) {
          const hold = holdOf(item, s, side)
          holds[`${id} ${itemId} ${side} ${label}`] = {
            hold: round(hold, 12),
            world: print(evaluateMotion(s, strut, { ...need(GOLDEN_STATES[label], label), hold }).world),
          }
        }
  }

  const stands = recordStands(GOLDEN_OUTFITS, fixture)

  // The hair spring over 40 steps: standing, walking, turning, at mixed frame times. The keeper in the elderly
  // gait supplies the head's pose; each step starts where the one before ended.
  const hair: unknown[] = []
  {
    const keeper = skeleton({ sliders: named.keeper.sliders })
    const elderly = need(fixture.gaits.elderly, 'elderly gait')
    const speed = 1.05
    const headTilt = 0.05
    let spring = HAIR_AT_REST
    let shown = 0
    let lastShown: number | null = null
    for (let i = 0; i < 40; i++) {
      const dt = [1 / 60, 1 / 30, 0.05, 1 / 144][i % 4] ?? 0
      const moving = i >= 8 && i < 26
      const phase = (i * 0.07) % 1
      if (i >= 18) shown = Math.min(1.2, (i - 17) * 0.15)
      const state: MotionState = {
        ...need(GOLDEN_STATES['idle 0'], 'idle 0'),
        moving,
        phase,
        yaw: shown,
        t: i * 0.05,
      }
      const head = i >= 4 ? at(base(keeper, elderly, state).world, J.head) : null
      const yawRate: number = lastShown === null ? 0 : (shown - lastShown) / dt
      const before = spring
      spring = hairStep(
        DEFAULT_HAIR,
        before,
        { moving, phase, speed, yawRate, nod: head ? headNod(head, shown) : 0, headTilt },
        dt,
      )
      lastShown = shown
      hair.push({ dt, moving, yawRate, phase, shown, head, before, after: spring })
    }
  }

  const lines = ['{', '  "bodies": {']
  Object.entries(bodies).forEach(([id, body], n, all) => {
    lines.push(
      `    ${JSON.stringify(id)}: {`,
      ...section(body, '      '),
      `    }${n < all.length - 1 ? ',' : ''}`,
    )
  })
  lines.push(
    '  },',
    '  "stands": {',
    ...section(stands, '    '),
    '  },',
    '  "holds": {',
    ...section(holds, '    '),
    '  },',
    `  "hair": ${JSON.stringify(round(hair, 12))}`,
    '}',
  )
  return `${lines.join('\n')}\n`
}

/** Wick's joints, in figure units, at the end of each action clip (the look twice: its turn out and held). */
async function recordActions(): Promise<string> {
  const { body, wick, library } = await fixtureMotion()
  const k = body.genes.height / 1.62
  const ends = Object.fromEntries(
    [
      ['reach', 'reach', 0.7],
      ['look-out', 'look', 1],
      ['look', 'look', 4],
      ['flinch', 'flinch', 1],
    ].map(([end, clip, since]) => {
      const { world } = evaluate(
        body,
        wick,
        { moving: false, speed: 0, facing: 0, action: { id: String(clip), startedAt: -Number(since) } },
        0,
        library,
      )
      return [end, world.map((m) => [9, 10, 11].map((c) => Number(((m[c] ?? 0) / k).toFixed(9))))]
    }),
  )
  return `${JSON.stringify({ body: 'wick', gait: 'bounce', ends })}\n`
}

/** Records every golden into `outDir` (made if need be) and returns the paths written. */
export async function recordGoldens(outDir: string): Promise<string[]> {
  mkdirSync(outDir, { recursive: true })
  const fixture = await fixtureFigures()
  const files: [string, string][] = [
    ['dress.json', recordDress(GOLDEN_OUTFITS, fixture)],
    ['motion.json', recordMotion(fixture)],
    ['actions.json', await recordActions()],
  ]
  return files.map(([name, text]) => {
    const path = join(outDir, name)
    writeFileSync(path, text)
    return path
  })
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--out')
  const out = flag >= 0 ? (process.argv[flag + 1] ?? GOLDENS) : GOLDENS
  for (const path of await recordGoldens(out)) console.log(`wrote ${path}`)
}
