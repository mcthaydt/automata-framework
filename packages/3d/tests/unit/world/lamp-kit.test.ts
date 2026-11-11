// The lamp kit's two kinds for a night room: `moon`, a cool soft light through a window, and `fill`, a soft light with no
// fitting and no glow. Each parses as a lamp, resolves against its kind and lights a floor.
import { describe, expect, it } from 'vitest'
import { worldLighting } from '#src/app/world-lighting.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { LAMP_KINDS, lampFault, resolveLamp } from '#src/features/world/lamp-kit.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { vertexLight } from '#src/shared/render/light/vertex-light.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

const LIB = { swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {} } }
const lit = (kind: string, extra: Record<string, unknown> = {}): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'room',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
  ],
  lamps: [{ id: 'l', kind, at: [3, 2.5, 3], ...extra }],
})

describe.each(['moon', 'fill'])('the %s lamp kind', (kind) => {
  it('is in the kit and is not at fault', () => {
    expect(LAMP_KINDS[kind]).toBeDefined()
    expect(lampFault({ kind, color: undefined })).toBeUndefined()
  })

  it('resolves to a colour, a range inside its band and a level', () => {
    const resolved = resolveLamp({ kind, color: undefined, range: undefined, level: undefined })
    const { range, peak } = LAMP_KINDS[kind] as unknown as { range: [number, number]; peak: number }
    const [low, high] = range
    expect(resolved.color).toBeGreaterThan(0)
    expect(resolved.range).toBeGreaterThanOrEqual(low)
    expect(resolved.range).toBeLessThanOrEqual(high)
    // The authored level is 1, held at the kind's peak: a soft kind is softer than 1.
    expect(resolved.level).toBe(Math.min(1, peak))
  })

  it('builds with no problem, and lights the floor under it', () => {
    const level = lit(kind)
    const world = buildWorld(level, LIB)
    expect(world.problems).toEqual([])
    expect(world.lamps).toHaveLength(1)
    const lighting = worldLighting(world, timeOfDay('night'))
    const lamp = lighting.lamps.find((candidate) => candidate.id === 'l')
    if (lamp === undefined) throw new Error('the lamp is not in the scene light')
    // The floor straight under it, 3 m down, facing up.
    expect(vertexLight({ x: 3, y: 0, z: 2.5, nx: 0, ny: 1, nz: 0 }, lamp, lighting)).toBeGreaterThan(0)
  })
})

describe('what separates them', () => {
  it('the moon is cooler than the fill and than every warm lamp', () => {
    const blue = (kind: string): number => {
      const { color } = resolveLamp({ kind, color: undefined, range: undefined, level: undefined })
      return (color & 255) - ((color >> 16) & 255)
    }
    expect(blue('moon')).toBeGreaterThan(0)
    expect(blue('moon')).toBeGreaterThan(blue('fill'))
    expect(blue('moon')).toBeGreaterThan(blue('bulb'))
  })

  it('the fill is softer than any lamp with a fitting: its peak is the lowest in the kit', () => {
    const peaks = Object.entries(LAMP_KINDS).map(([name, kind]) => [name, kind.peak] as const)
    expect(Math.min(...peaks.map(([, peak]) => peak))).toBe(LAMP_KINDS.fill?.peak)
  })

  it('the six old kinds are as they were', () => {
    expect(Object.keys(LAMP_KINDS)).toEqual(
      expect.arrayContaining(['pendant', 'bulb', 'desk', 'fluorescent', 'sodium', 'neon']),
    )
    expect(LAMP_KINDS.bulb).toEqual({ color: '#ffce7f', range: [3.5, 6], peak: 1.5 })
  })

  it('a moon off its tone is told, as any kind but neon is', () => {
    expect(lampFault({ kind: 'moon', color: '#ff0000' })?.code).toBe('lamp-off-tone')
  })
})
