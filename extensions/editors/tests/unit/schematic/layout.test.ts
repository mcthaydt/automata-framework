import { type AgentDef, hearsIn, isStill, routineMode, waitsIn } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { type Diagram, layoutAgent } from '#src/features/schematic/diagram/layout.ts'
import { fixture, SCENES } from '../../fixtures/systems-fixtures.ts'

const SIZE = { box: { w: 120, h: 52 }, gap: 56, label: 22 }

const agent = (over: Partial<AgentDef>): AgentDef => ({
  id: 'guard',
  modes: ['patrol', 'hunt', 'search'],
  initial: 'patrol',
  speed: { patrol: 1, hunt: 2, search: 1 },
  senses: [],
  transitions: [],
  ...over,
})

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function expectClean(diagram: Diagram, agentDef: AgentDef): void {
  const rects = [
    ...diagram.boxes.map((box, i) => ({ name: `box ${box.mode}`, rect: box, i })),
    ...diagram.arrows.map((arrow, i) => ({
      name: `label ${arrow.from}>${arrow.to}`,
      rect: arrow.label,
      i: 1000 + i,
    })),
  ]
  for (let a = 0; a < rects.length; a++)
    for (let b = a + 1; b < rects.length; b++) {
      const one = rects[a]
      const two = rects[b]
      if (one && two && overlap(one.rect, two.rect)) throw new Error(`${one.name} overlaps ${two.name}`)
    }
  const drawn = diagram.arrows.flatMap((arrow) => arrow.switches).sort((x, y) => x - y)
  expect(drawn).toEqual(agentDef.transitions.map((_, i) => i))
  for (const box of diagram.boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(diagram.width)
    expect(box.y + box.h).toBeLessThanOrEqual(diagram.height)
  }
  for (const arrow of diagram.arrows) {
    expect(arrow.label.x + arrow.label.w).toBeLessThanOrEqual(diagram.width)
    expect(arrow.label.y + arrow.label.h).toBeLessThanOrEqual(diagram.height)
    expect(arrow.points.length).toBeGreaterThanOrEqual(2)
  }
}

describe('the layout', () => {
  it('puts the start mode first and the rest in columns by how far they are from it', () => {
    const def = agent({
      transitions: [
        { from: 'patrol', to: 'hunt', when: [{ sees: true }], priority: 1 },
        { from: 'hunt', to: 'search', when: [], priority: 1 },
      ],
    })
    const { boxes } = layoutAgent(def, SIZE)
    const at = (mode: string) => boxes.find((box) => box.mode === mode)
    expect(at('patrol')?.x).toBe(0)
    expect(at('hunt')?.x).toBeGreaterThan(at('patrol')?.x ?? 0)
    expect(at('search')?.x).toBeGreaterThan(at('hunt')?.x ?? 0)
    expect(at('patrol')?.start).toBe(true)
    expect(at('hunt')?.start).toBe(false)
  })

  it('puts a mode nothing reaches in the last column', () => {
    const def = agent({ transitions: [{ from: 'patrol', to: 'hunt', when: [], priority: 1 }] })
    const { boxes } = layoutAgent(def, SIZE)
    const x = (mode: string) => boxes.find((box) => box.mode === mode)?.x ?? -1
    expect(x('search')).toBeGreaterThan(x('hunt'))
  })

  it('puts the any-mode box first when a switch comes from any mode', () => {
    const def = agent({ transitions: [{ from: '*', to: 'hunt', when: [{ touching: true }], priority: 1 }] })
    const { boxes } = layoutAgent(def, SIZE)
    const star = boxes.find((box) => box.mode === '*')
    expect(star).toBeDefined()
    expect(star?.x).toBe(0)
    expect(Math.min(...boxes.filter((box) => box.mode !== '*').map((box) => box.x))).toBeGreaterThan(0)
  })

  it('draws a switch back to its own mode as a loop', () => {
    const def = agent({ transitions: [{ from: 'hunt', to: 'hunt', when: [{ sees: true }], priority: 1 }] })
    const arrows = layoutAgent(def, SIZE).arrows
    expect(arrows).toHaveLength(1)
    expect(arrows[0]?.loop).toBe(true)
  })

  it('draws two switches between the same pair, asked at the same time, as one arrow', () => {
    const def = agent({
      transitions: [
        { from: 'patrol', to: 'hunt', when: [{ sees: true }], priority: 2 },
        { from: 'patrol', to: 'hunt', when: [{ touching: true }], priority: 1 },
      ],
    })
    const arrows = layoutAgent(def, SIZE).arrows
    expect(arrows).toHaveLength(1)
    expect(arrows[0]?.switches).toEqual([0, 1])
  })

  it('marks the patrol mode and a mode that stands still', () => {
    const def = agent({ speed: { patrol: 1, hunt: 2, search: 0 } })
    const { boxes } = layoutAgent(def, SIZE)
    expect(boxes.find((box) => box.mode === 'patrol')?.patrol).toBe(true)
    expect(boxes.find((box) => box.mode === 'search')?.still).toBe(true)
    expect(boxes.find((box) => box.mode === 'hunt')?.still).toBe(false)
  })
})

describe('the tall layout', () => {
  const TALL = { ...SIZE, tall: true }
  const def = agent({
    transitions: [
      { from: 'patrol', to: 'hunt', when: [{ sees: true }], priority: 1 },
      { from: 'hunt', to: 'search', when: [], priority: 1 },
      { from: 'search', to: 'patrol', when: [{ heard: '*' }], priority: 1 },
      { from: 'hunt', to: 'hunt', when: [{ touching: true }], priority: 2 },
    ],
  })

  it('stacks the modes top to bottom in the order the wide board runs left to right', () => {
    const wide = layoutAgent(def, SIZE).boxes
    const tall = layoutAgent(def, TALL).boxes
    const order = (boxes: typeof wide, axis: 'x' | 'y') =>
      [...boxes].sort((a, b) => a[axis] - b[axis]).map((box) => box.mode)
    expect(order(tall, 'y')).toEqual(order(wide, 'x'))
    expect(new Set(tall.map((box) => box.x)).size).toBe(1)
  })

  it('keeps each box its own size, so its words are not cut', () => {
    for (const box of layoutAgent(def, TALL).boxes) expect([box.w, box.h]).toEqual([120, 52])
  })

  it('draws the same arrows between the same modes, with no overlap', () => {
    const wide = layoutAgent(def, SIZE)
    const tall = layoutAgent(def, TALL)
    const key = (d: Diagram) =>
      d.arrows.map((arrow) => `${arrow.from}>${arrow.to}:${arrow.switches.join(',')}`).sort()
    expect(key(tall)).toEqual(key(wide))
    expectClean(tall, def)
  })

  it('starts at its own left edge: nothing is drawn left of 0, so no width is wasted beside the boxes', () => {
    const drawn = { box: { w: 160, h: 64 }, gap: 168, label: 52, labelW: 144, tall: true }
    const guard = agent({
      modes: ['patrol', 'hunt', 'follow'],
      transitions: [
        { from: '*', to: 'hunt', when: [{ sees: true }], priority: 1 },
        { from: 'hunt', to: 'follow', when: [{ touching: true }], priority: 1 },
        { from: 'hunt', to: 'patrol', when: [{ heard: '*' }], priority: 1 },
      ],
    })
    for (const character of [def, guard]) {
      const tall = layoutAgent(character, drawn)
      const xs = [
        ...tall.boxes.flatMap((box) => [box.x, box.x + box.w]),
        ...tall.arrows.flatMap((arrow) => [arrow.label.x, arrow.label.x + arrow.label.w]),
        ...tall.arrows.flatMap((arrow) => arrow.points.map(([x]) => x)),
      ]
      expect(Math.min(...xs)).toBe(0)
      expect(tall.width).toBe(Math.max(...xs))
      expectClean(tall, character)
    }
  })

  it('is narrower than the wide board at the size the diagram draws, which is the point of it', () => {
    const drawn = { box: { w: 160, h: 64 }, gap: 168, label: 52, labelW: 144 }
    const wide = layoutAgent(def, drawn)
    const tall = layoutAgent(def, { ...drawn, tall: true })
    expect(tall.width).toBeLessThan(wide.width)
    expectClean(tall, def)
  })
})

describe.each(SCENES)('on the %s scene', (scene) => {
  const def = fixture(scene)
  for (const character of def.agents)
    describe(character.id, () => {
      const diagram = layoutAgent(character, SIZE)

      it('draws every switch once, and no two boxes or labels overlap', () => {
        expectClean(diagram, character)
      })

      it('does the same laid out tall', () => {
        expectClean(layoutAgent(character, { ...SIZE, tall: true }), character)
      })

      it('says when each switch is asked, as the interpreter asks it', () => {
        for (const arrow of diagram.arrows)
          for (const index of arrow.switches) {
            const when = character.transitions[index]?.when ?? []
            const expected = hearsIn(when) ? 'hears' : waitsIn(when) ? 'stops' : 'always'
            expect(arrow.timing, `switch ${index}`).toBe(expected)
          }
      })

      it('marks the patrol mode and the still modes as the interpreter sees them', () => {
        for (const box of diagram.boxes.filter((b) => b.mode !== '*')) {
          expect(box.still).toBe(isStill(character, box.mode))
          expect(box.patrol).toBe(routineMode(character) === box.mode)
        }
      })
    })
})
