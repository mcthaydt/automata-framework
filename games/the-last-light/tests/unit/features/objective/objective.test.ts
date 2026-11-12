import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hudSchema } from '@automata/hud/content'
import type { Hotspot } from '@automata/interact/sim'
import type { Reader } from '@automata/puzzle/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { objectiveNow } from '#src/features/objective/objective.ts'

// The objective line is chosen by the rows of content/hud/play.toml, one list read first to last (T3: one list, not two
// ladders): the line's key and, when the row names a hotspot, the point to walk to. The old rules' order is the order.

const ROOT = join(import.meta.dirname, '../../../..')
const file = hudSchema.parse(parse(readFileSync(join(ROOT, 'content/hud/play.toml'), 'utf8')))

const spots: Hotspot[] = ['noticeboard', 'nightstand', 'shelf', 'closetDoor', 'cabinet', 'bed'].map(
  (id, i) => ({
    id,
    x: i,
    z: -i,
    reach: 1,
    name: `hotspot.${id}`,
  }),
)

/** A reader over a made-up state: the facts that are true, and the items carried (the lamp's `lit` and `fuel` are always there). */
const reader = (facts: Record<string, unknown>, items: readonly string[] = []): Reader => ({
  fact: (name) => facts[name] as never,
  has: (item) => items.includes(item),
})

describe('the HUD file', () => {
  it('has the five pieces, once each, and the nine objective lines', () => {
    expect(file.pieces.map((piece) => piece.kind).sort()).toEqual([
      'examine',
      'inventory',
      'keypad',
      'objective',
      'prompt',
    ])
    expect(new Set((file.objective ?? []).map((row) => row.line)).size).toBe(9)
  })
})

describe('the objective now', () => {
  const now = (facts: Record<string, unknown>, items: readonly string[] = []) =>
    objectiveNow(file, reader(facts, items), spots)

  it('is the note on the noticeboard at the start', () => {
    expect(now({ noteRead: false })).toEqual({ line: 'prologue.objective.note', target: { x: 0, z: -0 } })
  })

  it('goes from the note to the lamp, the fill, the key, the door, the sheets, the bed', () => {
    expect(now({ noteRead: true })?.line).toBe('prologue.objective.lamp')
    expect(now({ noteRead: true, lit: false, fuel: 0 }, ['handLamp'])?.line).toBe('prologue.objective.fill')
    expect(now({ noteRead: true, lit: true, fuel: 40 }, ['handLamp'])?.line).toBe('prologue.objective.key')
    expect(now({ noteRead: true, lit: true, fuel: 40 }, ['handLamp', 'supplyKey'])?.line).toBe(
      'prologue.objective.closet',
    )
    expect(now({ noteRead: true, lit: true, fuel: 40, closetOpen: true }, ['handLamp'])?.line).toBe(
      'prologue.objective.sheets',
    )
    expect(now({ noteRead: true, lit: true, fuel: 40, closetOpen: true }, ['handLamp', 'sheets'])).toEqual({
      line: 'prologue.objective.bed',
      target: { x: 5, z: -5 },
    })
  })

  it('points at the shelf for the sheets, and at no place for the fill', () => {
    expect(now({ noteRead: true, lit: true, fuel: 40, closetOpen: true }, ['handLamp'])?.target).toEqual({
      x: 2,
      z: -2,
    })
    expect(now({ noteRead: true, lit: false, fuel: 0 }, ['handLamp'])?.target).toBeUndefined()
  })

  it('is to hide after lights out, with no place, and to rest at the bed once she has gone', () => {
    expect(now({ lightsOut: true })).toEqual({ line: 'prologue.objective.hide', target: undefined })
    expect(now({ lightsOut: true, figureGone: true })).toEqual({
      line: 'prologue.objective.rest',
      target: { x: 5, z: -5 },
    })
  })
})
