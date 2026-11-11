// The lamp kit's kinds, a lamp's pool (`radius`) and a level's bounce points. The five kinds a night room needs beyond
// the original six (a screen, a fire, a spark, the moon and a cool fill) come from the look bible's lamp archetypes.
import { describe, expect, it } from 'vitest'
import { sceneLamps } from '#src/app/world-view.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { LAMP_KINDS, lampFault, resolveLamp } from '#src/features/world/lamp-kit.ts'
import type { AfSector2, LampPlace } from '#src/shared/level/af-sector-2.schema.ts'
import { readLevel } from '#src/shared/level/read-level.ts'

const level = (lamps: LampPlace[], extra: Partial<AfSector2> = {}): AfSector2 => ({
  format: 'af-sector/2',
  name: 'lamps',
  sectors: [
    {
      id: 'room',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
    },
  ],
  lamps,
  ...extra,
})

describe('the lamp kit', () => {
  it('has the five kinds a night room adds: screen, fire, spark, moon and fill', () => {
    expect(LAMP_KINDS.screen).toEqual({ color: '#91daa1', range: [2, 3.5], peak: 1.5 })
    expect(LAMP_KINDS.fire).toEqual({ color: '#f99b4e', range: [4, 6.5], peak: 1.5 })
    expect(LAMP_KINDS.spark).toEqual({ color: '#6dccff', range: [3, 5], peak: 2.5 })
    expect(LAMP_KINDS.moon).toEqual({ color: '#96b2d9', range: [3, 5], peak: 1 })
    expect(LAMP_KINDS.fill).toEqual({ color: '#96b2d9', range: [3.5, 6], peak: 1.25 })
  })

  it('leaves the six kinds it had as they were', () => {
    expect(LAMP_KINDS.pendant).toEqual({ color: '#ffd59b', range: [3.5, 6], peak: 1 })
    expect(LAMP_KINDS.neon?.peak).toBe(1.25)
    expect(LAMP_KINDS.sodium?.dusk).toBe(true)
  })

  it('holds the new kinds to their bands, peaks and tones', () => {
    const { lamps, problems } = buildWorld(
      level([
        { id: 'tube', kind: 'screen', at: [1, 1, 1.5], range: 99, level: 9 },
        { id: 'moon', kind: 'moon', at: [2, 2, 2.2], color: '#8fb0e0' },
      ]),
      { swatches: {} },
    )
    expect(problems.filter((p) => p.code.startsWith('unknown-lamp') || p.code === 'lamp-off-tone')).toEqual(
      [],
    )
    expect(lamps.find((l) => l.id === 'tube')).toMatchObject({ range: 3.5, level: 1.5, peak: 1.5 })
    expect(lampFault({ kind: 'moon', color: '#ff0000' })?.code).toBe('lamp-off-tone')
  })

  it('a lamp may name the radius of the pool of light it lays on the floor; none means 0', () => {
    expect(resolveLamp({ kind: 'desk' }).radius).toBe(0)
    expect(resolveLamp({ kind: 'desk', radius: 1.7 }).radius).toBe(1.7)
    const { lamps } = buildWorld(level([{ id: 'desk', kind: 'desk', at: [1, 1, 1.5], radius: 1.7 }]), {
      swatches: {},
    })
    expect(lamps[0]?.radius).toBe(1.7)
  })

  it('reads a level lamp radius as a number only', () => {
    const bad = readLevel(level([{ id: 'x', kind: 'desk', at: [1, 1, 1], radius: 'wide' as never }]))
    expect(bad.problems.length).toBeGreaterThan(0)
  })
})

describe('a level’s bounce points', () => {
  it('are [x, y, z] points the indirect light bounces from, kept by the reader', () => {
    const read = readLevel(
      level([], {
        bounce: [
          [3.05, 1.3, 1.15],
          [0, 1.3, -6],
        ],
      }),
    )
    expect(read.problems).toEqual([])
    expect(read.level?.bounce).toEqual([
      [3.05, 1.3, 1.15],
      [0, 1.3, -6],
    ])
  })

  it('must be triples of numbers', () => {
    expect(readLevel(level([], { bounce: [[1, 2]] as never })).problems.length).toBeGreaterThan(0)
  })
})

describe('lamp levels from PieceStates.lamps', () => {
  it('scale the authored level of a kind’s lamp, and a state may recolour it', () => {
    const { lamps } = buildWorld(
      level([
        { id: 'monitorGlow', kind: 'screen', at: [1, 1, 1.5], radius: 0 },
        { id: 'hallLamp', kind: 'pendant', at: [2, 2, 2.5], radius: 3.4 },
      ]),
      { swatches: {} },
    )
    const lit = sceneLamps(lamps, true, {
      hallLamp: { level: 0 },
      monitorGlow: { level: 0.5, color: 0x73d98c },
    })
    expect(lit.find((l) => l.id === 'hallLamp')?.level).toBe(0)
    expect(lit.find((l) => l.id === 'monitorGlow')).toMatchObject({ level: 0.5, color: 0x73d98c })
  })
})
