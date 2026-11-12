import { readLevel } from '@automata/3d/level'
import { hotspotsOf } from '@automata/interact/sim'
import { describe, expect, it } from 'vitest'
import { convertLevel } from '../../../tools/convert/level.ts'
import type { PlacedModel } from '../../../tools/convert/props-table.ts'

// The level converter on a tiny hand-written blockout: two rooms joined by a portal, a door in the wall, a wall
// preset, a hidden-from member the new format cannot say, and a few hotspots. What it writes must be a level the
// framework reads, and what it could not carry must be in the report.

const BLOCKOUT = {
  scene: 'prologue',
  walls: { PILASTER: { thick: 0, trim: { skirting: 0.3 } } },
  rooms: [
    {
      id: 'hall',
      zone: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [4, 0, { next: 'ward' }],
        [4, 4, { preset: 'PILASTER', door: { at: 1, width: 0.9, height: 2.1, id: 'staff' } }],
        [0, 4, { hideFrom: ['ward'], cut: 'south' }],
      ],
    },
    {
      id: 'ward',
      zone: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1.2,
      corners: [
        [4, 0, { next: 'hall' }],
        [8, 0],
        [8, 4],
        [4, 4],
      ],
    },
  ],
  masses: [
    {
      points: [
        { x: 1, z: 1 },
        { x: 2, z: 1 },
        { x: 2, z: 2 },
      ],
      top: 3,
    },
  ],
  spawn: { x: 0.6, y: 0.79, z: 3.6, facing: Math.PI },
  boxes: [{ id: 'desk', x: 2, z: 2, y: 0.5, w: 1, h: 1, d: 0.5, kind: 'desk', role: 'collider' }],
  hotspots: [
    { id: 'bed', x: 1, y: 0.9, z: 1, name: 'Bed 04', reach: 1.6, on: 'box:desk' },
    { id: 'locker', x: 5, y: 1, z: 1, name: 'Supply locker', reach: 1.4, hide: true },
    { id: 'shelf', x: 6, y: 1.2, z: 2, name: 'Supply shelf', reach: 1.3 },
    { id: 'scratches', x: 7, y: 1.4, z: 3, name: 'Scratched plaster', reach: 2.5 },
  ],
  lamps: [
    { id: 'hallLamp', kind: 'pendant', x: 2, y: 3.4, z: 2, range: 7.5, radius: 3.4, color: [1, 0.84, 0.6] },
    {
      id: 'monitorGlow',
      kind: 'screen',
      x: 6,
      y: 1.5,
      z: 1,
      range: 2.6,
      radius: 0,
      color: [0.45, 0.85, 0.55],
    },
  ],
  zones: [
    {
      id: 'hall',
      look: [0, 1.1, 0.75],
      distance: 16.6,
      follow: 0.12,
      depthFollow: { rate: 0.1, about: 2 },
      figureFill: 0.4,
    },
  ],
}

const MODELS: readonly PlacedModel[] = [
  { file: 'bed', x: -4.1, z: 0.4, size: [1.05, 0.95, 2.05], collider: 'bed' },
  { file: 'coat-hook', x: 2.35, z: -0.7, y: 0.92, size: [0.51, 1.15, 0.24] },
]

function converted() {
  const { files, report } = convertLevel(BLOCKOUT, MODELS)
  const text = files['content/levels/prologue.af-sector.json'] as string
  return { json: JSON.parse(text) as Record<string, unknown>, text, files, report }
}

describe('convertLevel', () => {
  it('writes a level the framework reads, with every room and the spawn', () => {
    const { json } = converted()
    const level = readLevel(json).level
    expect(level.sectors.map((sector) => sector.id)).toEqual(['hall', 'ward'])
    expect(level.entities?.find((entity) => entity.def === 'spawn')).toMatchObject({ x: 0.6, z: 3.6 })
  })

  it('writes a wall preset into the wall that names it, and keeps a door', () => {
    const { json } = converted()
    const hall = (json.sectors as { id: string; corners: unknown[][] }[]).find(
      (sector) => sector.id === 'hall',
    )
    expect(hall?.corners[2]?.[2]).toMatchObject({ thick: 0, trim: { skirting: 0.3 }, door: { id: 'staff' } })
    expect(hall?.corners[2]?.[2]).not.toHaveProperty('preset')
  })

  it("drops a wall's hideFrom and says so", () => {
    const { json, report } = converted()
    const hall = (json.sectors as { id: string; corners: unknown[][] }[]).find(
      (sector) => sector.id === 'hall',
    )
    expect(hall?.corners[3]?.[2]).toEqual({ cut: 'south' })
    expect(report).toContainEqual(expect.objectContaining({ kind: 'wall-member', did: 'dropped' }))
  })

  it('writes the hotspots as entities named by key, in the order given', () => {
    const { json } = converted()
    const read = hotspotsOf(readLevel(json).level)
    expect(read.problems).toEqual([])
    expect(read.hotspots.map((spot) => spot.id)).toEqual(['bed', 'locker', 'shelf'])
    expect(read.hotspots.map((spot) => spot.name)).toEqual(['hotspot.bed', 'hotspot.locker', 'hotspot.shelf'])
  })

  it('hides the hidden ones, and gates the shelf and the locker on the supply room door', () => {
    const { json } = converted()
    const spots = hotspotsOf(readLevel(json).level).hotspots
    const by = (id: string) => spots.find((spot) => spot.id === id)
    expect(by('locker')?.hide).toBe(true)
    expect(by('bed')?.hide).toBeUndefined()
    expect(by('locker')?.when).toEqual([{ fact: 'closetOpen', is: true }])
    expect(by('shelf')?.when).toEqual([{ fact: 'closetOpen', is: true }])
    expect(by('bed')?.when).toBeUndefined()
  })

  it("leaves out the three hotspots act one's prologue hides", () => {
    expect(converted().text).not.toContain('scratches')
  })

  it("writes each hotspot's English name into the interface catalog, as written", () => {
    const { files } = converted()
    expect(JSON.parse(files['messages/ui/en.json'] as string)).toEqual({
      'hotspot.bed': 'Bed 04',
      'hotspot.locker': 'Supply locker',
      'hotspot.shelf': 'Supply shelf',
    })
  })

  it('gives each camera zone a view with its numbers, and reports the fill it drops', () => {
    const { json, report } = converted()
    expect((json.views as Record<string, unknown>).hall).toMatchObject({
      distance: 16.6,
      follow: 0.12,
      look: [0, 1.1, 0.75],
      depthFollow: { rate: 0.1, about: 2 },
    })
    expect((json.sectors as { id: string; view?: string }[]).map((sector) => sector.view)).toEqual([
      'hall',
      'hall',
    ])
    expect(report).toContainEqual(
      expect.objectContaining({ kind: 'camera', what: expect.stringContaining('figureFill') }),
    )
  })

  it('writes lamps in the kit’s kinds, and reports a kind the kit lacks', () => {
    const { json, report } = converted()
    const lamps = json.lamps as { id: string; kind: string; at: number[]; color: string }[]
    expect(lamps[0]).toMatchObject({ id: 'hallLamp', kind: 'pendant', at: [2, 3.4, 2], color: '#ffd699' })
    expect(lamps[1]?.kind).toBe('bulb')
    expect(report).toContainEqual(expect.objectContaining({ kind: 'lamp-kind', where: 'monitorGlow' }))
  })

  it('places a model as a generator and a model with none as a box of its size, reporting the box', () => {
    const { json, report } = converted()
    const props = json.props as { id: string; use?: string; kind?: string; at: number[] }[]
    expect(props.find((prop) => prop.id === 'bed')).toMatchObject({ use: 'bed', at: [-4.1, 0.4] })
    expect(props.find((prop) => prop.id === 'coat-hook')).toMatchObject({
      kind: 'box',
      at: [2.35, -0.7, 0.92],
    })
    expect(report).toContainEqual(
      expect.objectContaining({ kind: 'prop', where: 'coat-hook', did: 'approximated' }),
    )
  })

  it('is the same text twice', () => {
    expect(converted().text).toBe(converted().text)
  })
})
