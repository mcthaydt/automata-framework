// The light a painted figure takes from its room costs at most 2 ms a frame at the median and 6 ms at the worst frame for eight D2
// figures walking through the base interior's light. A timing, so it runs in the bench project (`AF_BENCH=1`), never in a gate:
//
//   AF_BENCH=1 pnpm --filter @automata/character-kit exec vitest run --project bench tests/bench/lit.bench.test.ts
//
// It times what lighting adds to a painted frame: `roomLight` (the probes) and `litCells().lit` (the lit cell, made once on a miss),
// less the `cellOf(figure)` the painter pays with or without a light. Three scenarios, each its own numbers: `steady` (the walk
// under the lamps as authored), `switch` (the lamps go out at frame 300 and come back at 450, so every figure in their reach relights
// in one frame) and `flicker` (one lamp steps between 1 and 0.5 every 1/12 s of the clock). `LIT_BENCH_OUT` names a file the numbers
// are written to as JSON, for the gate.
import { writeFileSync } from 'node:fs'
import { buildWorld, createSceneLight, timeOfDay, worldLighting } from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { describe, expect, it } from 'vitest'
import { litCells } from '#src/features/painted/lit-cells.ts'
import { roomLight } from '#src/features/painted/room-light.ts'
import { BASE, cellOf, Figure, member, SPRITE_PITCH, type V3 } from '#src/shared/figure-builder/door.ts'

const { performance } = globalThis as unknown as { performance: { now(): number } }

const FIGURES = 8
const WARM_UP = 120
const FRAMES = 600
const DT = 1 / 60
/** The budget: milliseconds a frame, at the median and at the worst frame. */
const BUDGET = { median: 2, worst: 6 }

interface Numbers {
  median: number
  p95: number
  worst: number
  hits: number
  misses: number
}

type Scenario = 'steady' | 'switch' | 'flicker'

/** Eight figures (the base pair, four each) walking circles round the room's centre, and the cost of their light for `scenario`. */
function run(scenario: Scenario): Numbers {
  const light = createSceneLight(
    worldLighting(
      buildWorld(BASE_SCENES['base-interior'], baseLibrary, { night: true }),
      timeOfDay('lampLit'),
    ),
  )
  const lamps = light.lighting.lamps
  const figures = Array.from({ length: FIGURES }, (_, i) => {
    const def = BASE[i % BASE.length]?.def
    if (def === undefined) throw new Error('the builder has no base pair')
    return {
      figure: new Figure(member(def, 2)),
      cells: litCells(),
      seen: new WeakSet<Uint8ClampedArray>(),
      phase: (i / FIGURES) * Math.PI * 2,
    }
  })
  const costs: number[] = []
  let hits = 0
  let misses = 0
  for (let frame = 0; frame < WARM_UP + FRAMES; frame++) {
    const t = frame * DT
    if (scenario === 'switch' && (frame === 300 + WARM_UP || frame === 450 + WARM_UP)) {
      const level = frame === 300 + WARM_UP ? 0 : 1
      light.setLevels(Object.fromEntries(lamps.map((lamp) => [lamp.id, level])))
    }
    const first = lamps[0]
    if (scenario === 'flicker' && first !== undefined)
      light.setLevels({ [first.id]: Math.floor(t * 12) % 2 === 0 ? 1 : 0.5 })
    let added = 0
    let paid = 0
    for (const entry of figures) {
      const angle = entry.phase + t * 0.6
      const at: V3 = [Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5]
      // The painter's own work, not counted: pose and paint the frame.
      entry.figure.update(DT, {
        facing: angle + Math.PI / 2,
        moving: true,
        view: { azimuth: 0, pitch: SPRITE_PITCH },
      })
      const a = performance.now()
      cellOf(entry.figure)
      paid += performance.now() - a
      const b = performance.now()
      const room = roomLight((x, y, z, n) => light.tint(x, y, z, n), light.lighting.sun, at, 0)
      const cell = entry.cells.lit(entry.figure, room)
      added += performance.now() - b
      if (frame >= WARM_UP) {
        if (entry.seen.has(cell.rgba)) hits++
        else misses++
      }
      entry.seen.add(cell.rgba)
    }
    if (frame >= WARM_UP) costs.push(Math.max(0, added - paid))
  }
  const sorted = [...costs].sort((a, b) => a - b)
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0
  return { median: at(0.5), p95: at(0.95), worst: sorted[sorted.length - 1] ?? 0, hits, misses }
}

describe('eight lit D2 figures', () => {
  const measured: Record<string, Numbers> = {}
  for (const scenario of ['steady', 'switch', 'flicker'] as const)
    it(`${scenario}: the light costs at most ${BUDGET.median} ms a frame at the median and ${BUDGET.worst} ms at the worst`, () => {
      const numbers = run(scenario)
      measured[scenario] = numbers
      console.log(`${scenario}: ${JSON.stringify(numbers)}`)
      const out = process.env.LIT_BENCH_OUT
      if (out !== undefined)
        writeFileSync(
          out,
          `${JSON.stringify({ ...measured, machine: `${process.platform} ${process.arch}, node ${process.version}` }, null, 2)}\n`,
        )
      expect(numbers.median).toBeLessThanOrEqual(BUDGET.median)
      expect(numbers.worst).toBeLessThanOrEqual(BUDGET.worst)
    }, 120_000)
})
