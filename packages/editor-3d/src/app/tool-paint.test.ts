// What the active tool paints over the plan (ED3D.6g-a step 4): the drawing's edges with their lengths, its corners, the
// snap point and the closing ring; a Wall, Vertex or Split target as a mark at its point, in the refusal colour with
// the tool's sentence when a tap would be refused; the Split cut; the rooms Merge would join. Canvas pixels from the
// same viewport the plan uses, so the overlay can never drift from the walls under it.
import { describe, expect, it } from 'vitest'
import { PLAN_COLORS } from '../view/plan/plan-colors'
import type { PaintFill } from '../view/plan/plan-paint'
import { planViewport } from '../view/plan/plan-viewport'
import type { PlanToolState } from './plan-tools'
import { toolPaint } from './tool-paint'

// 32 px to a metre, the origin at (400, 200).
const viewport = planViewport({ x: 0, z: 0, zoom: 1 }, { w: 800, h: 400 })
const fills: readonly PaintFill[] = [
  { sector: 'hall', points: [0, 0, 10, 0, 10, 10], holes: [], color: 0, selected: false },
  { sector: 'dock', points: [20, 0, 30, 0, 30, 10], holes: [], color: 0, selected: false },
]

const drawing = (
  overrides: Partial<Extract<PlanToolState, { tool: 'polygon' }>['view']> = {},
): PlanToolState => ({
  tool: 'polygon',
  view: {
    shape: 'polygon',
    corners: [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ],
    snap: { x: 2, z: 1, kind: 'grid' },
    edges: [
      { a: { x: 0, z: 0 }, b: { x: 2, z: 0 }, length: 2, pending: false },
      { a: { x: 2, z: 0 }, b: { x: 2, z: 1 }, length: 1, pending: true },
    ],
    closing: false,
    loupe: undefined,
    refusal: undefined,
    offers: [],
    ...overrides,
  },
})

describe('tool paint', () => {
  it('paints nothing for Select', () => {
    const paint = toolPaint({ tool: 'select', view: {} as never }, viewport, fills)
    expect(paint).toEqual({ strokes: [], dots: [], outlines: [], labels: [] })
  })

  it('paints the drawing: solid placed edges, a dashed pending edge, the corners, the snap ring and each length', () => {
    const paint = toolPaint(drawing(), viewport, fills)
    expect(paint.strokes).toEqual([
      { a: { x: 400, y: 200 }, b: { x: 464, y: 200 }, color: PLAN_COLORS.accent, width: 2, dashed: false },
      { a: { x: 464, y: 200 }, b: { x: 464, y: 232 }, color: PLAN_COLORS.accent, width: 2, dashed: true },
    ])
    expect(paint.dots).toEqual([
      { at: { x: 400, y: 200 }, radius: 4, color: PLAN_COLORS.accent, ring: false },
      { at: { x: 464, y: 200 }, radius: 4, color: PLAN_COLORS.accent, ring: false },
      { at: { x: 464, y: 232 }, radius: 7, color: PLAN_COLORS.snap, ring: true },
    ])
    expect(paint.labels).toEqual([
      { at: { x: 432, y: 200 }, text: '2.00 m', tone: 'length' },
      { at: { x: 464, y: 216 }, text: '1.00 m', tone: 'length' },
    ])
  })

  it('rings the first corner while a tap would close the outline', () => {
    const paint = toolPaint(drawing({ closing: true }), viewport, fills)
    expect(paint.dots).toContainEqual({
      at: { x: 400, y: 200 },
      radius: 11,
      color: PLAN_COLORS.accent,
      ring: true,
    })
  })

  it('marks a wall tool target in the accent, or in the refusal colour with its sentence', () => {
    const place = {
      sector: 'hall',
      corner: 0,
      selection: 'wall:hall/0',
      length: 4,
      along: 1,
      point: { x: 1, z: 0 },
    }
    const ok = toolPaint(
      { tool: 'door', view: { target: { ...place, action: 'place' }, refusal: undefined } },
      viewport,
      fills,
    )
    expect(ok.dots).toEqual([{ at: { x: 432, y: 200 }, radius: 7, color: PLAN_COLORS.accent, ring: true }])
    expect(ok.labels).toEqual([])
    const no = toolPaint(
      {
        tool: 'door',
        view: { target: { ...place, action: 'none', reason: 'a portal has no door' }, refusal: undefined },
      },
      viewport,
      fills,
    )
    expect(no.dots).toEqual([{ at: { x: 432, y: 200 }, radius: 7, color: PLAN_COLORS.refused, ring: true }])
    expect(no.labels).toEqual([{ at: { x: 432, y: 200 }, text: 'a portal has no door', tone: 'refused' }])
  })

  it('paints the Split cut with its length and the start of it', () => {
    const paint = toolPaint(
      {
        tool: 'split',
        view: {
          start: { sector: 'hall', point: { x: 0, z: 0 } },
          target: undefined,
          cut: { a: { x: 0, z: 0 }, b: { x: 0, z: 2 }, length: 2 },
          refusal: undefined,
        },
      },
      viewport,
      fills,
    )
    expect(paint.strokes).toEqual([
      { a: { x: 400, y: 200 }, b: { x: 400, y: 264 }, color: PLAN_COLORS.accent, width: 2, dashed: true },
    ])
    expect(paint.dots).toEqual([
      { at: { x: 400, y: 200 }, radius: 4, color: PLAN_COLORS.accent, ring: false },
    ])
    expect(paint.labels).toEqual([{ at: { x: 400, y: 232 }, text: '2.00 m', tone: 'length' }])
  })

  it('outlines the room Merge keeps and the one it would take in', () => {
    const paint = toolPaint(
      {
        tool: 'merge',
        view: { keep: 'hall', target: { sector: 'dock', action: 'merge' }, refusal: undefined },
      },
      viewport,
      fills,
    )
    expect(paint.outlines).toEqual([
      { points: [0, 0, 10, 0, 10, 10], color: PLAN_COLORS.accent },
      { points: [20, 0, 30, 0, 30, 10], color: PLAN_COLORS.snap },
    ])
  })
})
