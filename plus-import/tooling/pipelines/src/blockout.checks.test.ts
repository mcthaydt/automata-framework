import type { Blockout } from '@mcthaydt/automata-sector-format/blockout'
import { describe, expect, it } from 'vitest'
import { validateBlockout } from './blockout.checks.ts'
import { TOY } from './testing/toy-blockout.ts'

// `validate` (M6 spec §4.11, M6.11): the generic half of the adventure source's checks, as plain findings. A sound blockout has none;
// each case below breaks one thing and names where.

const rules = (b: unknown): string[] => validateBlockout(b).map((f) => f.rule)
const details = (b: unknown): string =>
  validateBlockout(b)
    .map((f) => f.detail)
    .join(' | ')
const edit = (change: (b: Blockout) => Partial<Blockout>): Blockout => ({ ...TOY, ...change(TOY) })

describe('validateBlockout', () => {
  it('passes a sound blockout with its nav derived', () => {
    expect(validateBlockout(TOY)).toEqual([])
  })

  it('stops at the schema, naming the path', () => {
    const found = validateBlockout({ ...TOY, rooms: 'x' })
    expect(found.map((f) => f.rule)).toEqual(['schema'])
    expect(found[0]?.detail).toContain('rooms')
  })

  it('stops at an expansion that cannot be made (an opening no pair of walls covers)', () => {
    const bad = edit((b) => ({
      openings: [{ ...(b.openings?.[0] as NonNullable<Blockout['openings']>[0]), span: [3.5, 4.5] }],
    }))
    expect(rules(bad)).toEqual(['expand'])
    expect(details(bad)).toContain('no pair of facing')
  })

  it('refuses a repeated id among rooms, boxes and zones', () => {
    expect(
      details(
        edit((b) => ({ rooms: [b.rooms[0] as Blockout['rooms'][0], b.rooms[0] as Blockout['rooms'][0]] })),
      ),
    ).toMatch(/room a/)
    expect(details(edit((b) => ({ boxes: [...(b.boxes ?? []), ...(b.boxes ?? [])] })))).toMatch(/box abDoor/)
    expect(details(edit((b) => ({ zones: [...b.zones, ...b.zones] })))).toMatch(/zone a/)
  })

  it('refuses an opening whose door is not a door box', () => {
    const bad = edit((b) => ({
      boxes: (b.boxes ?? []).map((box) => ({ ...box, kind: 'desk' as const, role: 'collider' as const })),
    }))
    expect(rules(bad)).toContain('doors')
    expect(details(bad)).toContain('abDoor is not a door box')
  })

  it('refuses a door box no opening closes', () => {
    const bad = edit((b) => ({
      openings: [{ ...(b.openings?.[0] as NonNullable<Blockout['openings']>[0]), door: undefined }],
    }))
    expect(details(bad)).toContain('door box abDoor closes no opening')
  })

  it('refuses an attachment to nothing, and a wall that is not there', () => {
    const nothing = edit((b) => ({
      hotspots: [{ ...(b.hotspots?.[0] as NonNullable<Blockout['hotspots']>[0]), on: 'box:ghost' }],
    }))
    expect(details(nothing)).toContain('hotspot far is on box:ghost')
    const wall = edit((b) => ({
      hotspots: [{ ...(b.hotspots?.[0] as NonNullable<Blockout['hotspots']>[0]), on: 'wall:a/9' }],
    }))
    expect(details(wall)).toContain('wall:a/9')
  })

  it('refuses a hand-written nav edge through a box', () => {
    const bad = edit((b) => ({
      boxes: [
        ...(b.boxes ?? []),
        { id: 'wall', role: 'collider', kind: 'furniture', x: 2, z: 1.5, y: 1, w: 0.2, h: 2, d: 3 },
      ],
      nav: { derive: false, nodes: { p: { x: 1, z: 1.5 }, q: { x: 3, z: 1.5 } }, edges: [['p', 'q']] },
    }))
    expect(rules(bad)).toContain('nav')
    expect(details(bad)).toMatch(/p.q.*box wall/)
  })

  it('refuses a nav node the spawn cannot reach', () => {
    const bad = edit(() => ({
      nav: { derive: false, nodes: { p: { x: 1, z: 1 }, q: { x: 6, z: 3 } }, edges: [] },
    }))
    expect(details(bad)).toMatch(/q is not reachable/)
  })

  it('reports every finding, not the first', () => {
    const bad = edit((b) => ({
      zones: [...b.zones, ...b.zones],
      hotspots: [{ ...(b.hotspots?.[0] as NonNullable<Blockout['hotspots']>[0]), on: 'box:ghost' }],
    }))
    expect(validateBlockout(bad).length).toBeGreaterThanOrEqual(2)
  })
})
