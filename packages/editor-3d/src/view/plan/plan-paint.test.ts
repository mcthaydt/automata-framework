import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { ThingDef } from '../../entities/thing-def.schema'
import type { EntityKit, Thing } from '../../entities/things'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import { selectionOf } from '../selection-of'
import { PLAN_COLORS, parseHex } from './plan-colors'
import { groupColor, type PlanPaintInput, planPaint } from './plan-paint'
import { planScene } from './plan-scene'
import { planViewport } from './plan-viewport'

// The plan's paint list (plan ED3D.5d step 2). The camera looks at (7, 3) at zoom 1 (32 px to a metre) in a 640×480
// canvas, so the plan's origin is at (96, 144) and every case reads in pixels from there.

const SIZE = { w: 640, h: 480 }
const viewport = planViewport({ x: 7, z: 3, zoom: 1 }, SIZE)
const px = (x: number, z: number) => ({ x: 96 + x * 32, y: 144 + z * 32 })

const definitions: readonly ThingDef[] = [
  { id: 'lamp', shape: 'point', color: '#f4e285', fields: [] },
  { id: 'crate', shape: 'box', size: [2, 1, 1], fields: [] },
  {
    id: 'zone',
    shape: 'point',
    color: '#a78bfa',
    area: ['x0', 'z0', 'x1', 'z1'],
    fields: [],
  },
]
const thing = (def: string, id: string, x: number, z: number, values: Thing['values'] = {}): Thing => ({
  def,
  id,
  x,
  z,
  values,
})

function inputOf(level: AfSector, more: Partial<PlanPaintInput> = {}): PlanPaintInput {
  const hidden = more.hidden ?? []
  return {
    scene: planScene(afSectorProfile.geometry(level).layers, selectionOf(afSectorProfile, level), { hidden }),
    kit: { definitions: [], things: [], problems: [] },
    links: [],
    viewport,
    grid: 0.25,
    hidden,
    selected: new Set(),
    ...more,
  }
}

describe('colours', () => {
  it('reads the mockups’ hex colours as numbers', () => {
    expect(parseHex('#5aa9e6')).toBe(0x5aa9e6)
    expect(parseHex('#fff')).toBe(0xffffff)
    expect(parseHex('teal')).toBeUndefined()
    expect(PLAN_COLORS.portal).toBe(0x5aa9e6)
    expect(PLAN_COLORS.background).toBe(0x0c0d10)
  })

  it('gives a group the same fill wherever it is, and no group the neutral one', () => {
    expect(groupColor('clinic')).toBe(groupColor('clinic'))
    expect(groupColor('')).toBe(PLAN_COLORS.fill)
    const many = new Set(['hall', 'ward', 'counter', 'corridor', 'closet', 'mouth'].map(groupColor))
    expect(many.size).toBeGreaterThan(3)
  })
})

describe('planPaint fills and walls', () => {
  it('fills each sector in screen pixels with its group’s colour', () => {
    const paint = planPaint(inputOf(toyAfSector()))
    expect(paint.background).toBe(PLAN_COLORS.background)
    expect(paint.accent).toBe(PLAN_COLORS.accent)
    expect(paint.gridColor).toBe(PLAN_COLORS.grid)
    const hall = paint.fills.find((fill) => fill.sector === 'hall')
    expect(hall?.points).toEqual([px(0, 0), px(8, 0), px(8, 6), px(0, 6)].flatMap((p) => [p.x, p.y]))
    expect(hall?.color).toBe(groupColor(''))
    expect(hall?.selected).toBe(false)
  })

  it('strokes a wall by its kind: solid, portal dashed', () => {
    const paint = planPaint(inputOf(toyAfSector()))
    const portal = paint.walls.filter((wall) => wall.color === PLAN_COLORS.portal)
    expect(portal).toHaveLength(1)
    expect(portal[0]).toMatchObject({ a: px(8, 0), b: px(8, 6), dashed: true })
    const solid = paint.walls.filter((wall) => wall.color === PLAN_COLORS.wall)
    expect(solid.length).toBe(6)
    expect(solid.every((wall) => !wall.dashed && wall.width === 2.5)).toBe(true)
  })

  it('draws a door as a thick piece over its span of the wall', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'hall',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0, { door: { at: 2, width: 1, height: 2.1 } }],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
      ],
    })
    const paint = planPaint(inputOf(level))
    const door = paint.walls.find((wall) => wall.color === PLAN_COLORS.door)
    expect(door).toMatchObject({ a: px(1.5, 0), b: px(2.5, 0), width: 5 })
  })

  it('outlines what is selected in the accent', () => {
    const paint = planPaint(inputOf(toyAfSector(), { selected: new Set(['sector:hall']) }))
    expect(paint.fills.find((fill) => fill.sector === 'hall')?.selected).toBe(true)
    const accent = paint.walls.filter((wall) => wall.color === PLAN_COLORS.accent)
    expect(accent.length).toBe(4)
  })

  it('leaves out a hidden layer', () => {
    const paint = planPaint(inputOf(toyAfSector(), { hidden: ['sectors', 'walls'] }))
    expect(paint.fills).toEqual([])
    expect(paint.walls).toEqual([])
  })
})

describe('planPaint things', () => {
  const kit: EntityKit = {
    definitions,
    things: [
      thing('lamp', 'l1', 1, 1),
      thing('crate', 'c1', 4, 2),
      thing('zone', 'z1', 0, 0, { x0: 1, z0: 1, x1: 3, z1: 2 }),
      thing('ghost', 'g1', 5, 5),
    ],
    problems: [],
  }

  it('marks a point with a disc, a box with its footprint and an area with a dashed rectangle', () => {
    const paint = planPaint(inputOf(toyAfSector(), { kit }))
    expect(paint.things).toHaveLength(3)
    const [lamp, crate, zone] = paint.things
    expect(lamp).toMatchObject({ shape: 'disc', ...px(1, 1), color: 0xf4e285, selected: false })
    const corner = px(3, 1.5)
    expect(crate).toMatchObject({
      shape: 'rect',
      x: corner.x,
      y: corner.y,
      w: 64,
      h: 32,
      color: PLAN_COLORS.box,
    })
    expect(zone).toMatchObject({ shape: 'rect', ...px(1, 1), w: 64, h: 32, dashed: true, color: 0xa78bfa })
  })

  it('leaves out a hidden sub-layer and keeps a locked one', () => {
    const paint = planPaint(inputOf(toyAfSector(), { kit, hidden: ['things:lamp'] }))
    expect(paint.things.map((mark) => mark.id)).toEqual(['c1', 'z1'])
    expect(planPaint(inputOf(toyAfSector(), { kit, hidden: ['things'] })).things).toEqual([])
  })

  it('marks a selected thing and joins linked things with a line', () => {
    const paint = planPaint(
      inputOf(toyAfSector(), {
        kit: { ...kit, things: [...kit.things, thing('lamp', 'l2', 4, 2)] },
        selected: new Set(['entity:lamp/l1']),
        links: [{ a: 'l1', b: 'l2' }],
        linkDef: 'lamp',
      }),
    )
    expect(paint.things[0]?.selected).toBe(true)
    expect(paint.links).toEqual([{ a: px(1, 1), b: px(4, 2), color: 0xf4e285 }])
  })
})

describe('planPaint grid and rulers', () => {
  it('draws the grid inside the view, majors every fourth line, with a ruler label on each major', () => {
    const paint = planPaint(inputOf(toyAfSector()))
    // 32 px a metre: a 0.5 m step (16 px), so the majors fall every 2 m.
    const xs = paint.grid.filter((line) => line.a.y === 0)
    expect(xs.every((line) => line.a.x >= 0 && line.a.x <= SIZE.w)).toBe(true)
    expect(xs.find((line) => line.a.x === 96)?.major).toBe(true)
    expect(xs.find((line) => line.a.x === 112)?.major).toBe(false)
    expect(paint.rulers.x.find((tick) => tick.at === 96)?.label).toBe('0')
    expect(paint.rulers.x.find((tick) => tick.at === 160)?.label).toBe('2')
    expect(paint.rulers.z.find((tick) => tick.at === 144)?.label).toBe('0')
    expect(paint.rulers.z.find((tick) => tick.at === 80)?.label).toBe('−2')
  })
})
